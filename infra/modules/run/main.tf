# Serviços e jobs do Cloud Run (estágio E0): mínimo 0 e máximo 3 instâncias, CPU só durante a requisição, uma imagem.
variable "project_id" { type = string }
variable "project_number" { type = string }
variable "region" { type = string }
variable "imagem" { type = string }
variable "min_instance_count" { type = number }
variable "max_instance_count" { type = number }
variable "sa" { type = map(string) }
variable "chave_jwt" { type = string }
variable "github_client_id" {
  type    = string
  default = ""
}
variable "chave_pacotes" { type = string }
variable "bucket_pacotes" { type = string }
variable "topico_orcamento" { type = string }

locals {
  url_sts           = "https://odin-sts-${var.project_number}.${var.region}.run.app"
  url_mcp           = "https://odin-mcp-${var.project_number}.${var.region}.run.app"
  segredos          = ["odin-pimenta", "odin-segredo-url", "odin-ativacao-admin", "odin-oauth-client-secret"]
  servicos_publicos = ["odin-sts", "odin-mcp"]
}

data "google_secret_manager_secret" "s" {
  for_each  = toset(local.segredos)
  secret_id = each.value
}

# Acesso mínimo aos segredos: cada conta lê só os seus.
resource "google_secret_manager_secret_iam_member" "sts_pimenta" {
  secret_id = data.google_secret_manager_secret.s["odin-pimenta"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.sa["sa-sts"]}"
}
resource "google_secret_manager_secret_iam_member" "sts_ativacao" {
  secret_id = data.google_secret_manager_secret.s["odin-ativacao-admin"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.sa["sa-sts"]}"
}
resource "google_secret_manager_secret_iam_member" "sts_oauth" {
  secret_id = data.google_secret_manager_secret.s["odin-oauth-client-secret"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.sa["sa-sts"]}"
}
resource "google_secret_manager_secret_iam_member" "mcp_url" {
  secret_id = data.google_secret_manager_secret.s["odin-segredo-url"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.sa["sa-mcp"]}"
}

# Firestore: papel no projeto (o banco é único; o isolamento por serviço é feito pela aplicação).
resource "google_project_iam_member" "datastore" {
  for_each = toset(["sa-mcp", "sa-sts", "sa-publisher", "sa-jobs", "sa-indexer", "sa-portal"])
  project  = var.project_id
  role     = "roles/datastore.user"
  member   = "serviceAccount:${var.sa[each.value]}"
}

resource "google_cloud_run_v2_service" "sts" {
  name                = "odin-sts"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  template {
    service_account                  = var.sa["sa-sts"]
    max_instance_request_concurrency = 80
    timeout                          = "30s"
    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }
    containers {
      image = var.imagem
      args  = ["apps/sts/src/main.ts"]
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "EMISSOR"
        value = local.url_sts
      }
      env {
        name  = "URL_MCP"
        value = local.url_mcp
      }
      env {
        name  = "CHAVE_JWT"
        value = var.chave_jwt
      }
      env {
        name  = "GITHUB_CLIENT_ID"
        value = var.github_client_id
      }
      startup_probe {
        http_get { path = "/saude" }
        period_seconds    = 3
        failure_threshold = 10
      }
    }
  }
  depends_on = [google_project_iam_member.datastore, google_secret_manager_secret_iam_member.sts_pimenta, google_secret_manager_secret_iam_member.sts_ativacao, google_secret_manager_secret_iam_member.sts_oauth]
}

resource "google_cloud_run_v2_service" "mcp" {
  name                = "odin-mcp"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  template {
    service_account                  = var.sa["sa-mcp"]
    max_instance_request_concurrency = 80
    timeout                          = "60s"
    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }
    containers {
      image = var.imagem
      args  = ["apps/mcp-server/src/main.ts"]
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "EMISSOR"
        value = local.url_sts
      }
      env {
        name  = "URL_MCP"
        value = local.url_mcp
      }
      env {
        name  = "BUCKET_PACOTES"
        value = var.bucket_pacotes
      }
      startup_probe {
        http_get { path = "/saude" }
        period_seconds    = 3
        failure_threshold = 10
      }
    }
  }
  depends_on = [google_project_iam_member.datastore, google_secret_manager_secret_iam_member.mcp_url]
}

# Os dois serviços são públicos na borda (sem Load Balancer em E0); toda rota útil exige token (segurança 07, seção 4).
# odin:permitir-publico
resource "google_cloud_run_v2_service_iam_member" "publico" {
  for_each = { sts = google_cloud_run_v2_service.sts.name, mcp = google_cloud_run_v2_service.mcp.name }
  location = var.region
  name     = each.value
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Jobs: sem porta, sem custo parado.
resource "google_cloud_run_v2_job" "jobs" {
  name                = "odin-jobs"
  location            = var.region
  deletion_protection = false
  template {
    template {
      service_account = var.sa["sa-jobs"]
      max_retries     = 1
      timeout         = "300s"
      containers {
        image = var.imagem
        args  = ["apps/jobs/src/main.ts", "tick"]
        resources { limits = { cpu = "1", memory = "512Mi" } }
        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }
      }
    }
  }
}

resource "google_cloud_run_v2_job" "publisher" {
  name                = "odin-publisher"
  location            = var.region
  deletion_protection = false
  template {
    template {
      service_account = var.sa["sa-publisher"]
      max_retries     = 0
      timeout         = "300s"
      containers {
        image = var.imagem
        args  = ["apps/jobs/src/main.ts", "publisher"]
        resources { limits = { cpu = "1", memory = "512Mi" } }
        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }
        env {
          name  = "BUCKET_PACOTES"
          value = var.bucket_pacotes
        }
        env {
          name  = "CHAVE_PACOTES"
          value = var.chave_pacotes
        }
      }
    }
  }
}

# Um agendamento único (odin-tick) executa o odin-jobs a cada 15 minutos.
resource "google_cloud_run_v2_job_iam_member" "tick_executa" {
  location = var.region
  name     = google_cloud_run_v2_job.jobs.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.sa["sa-tick"]}"
}
resource "google_cloud_scheduler_job" "tick" {
  name        = "odin-tick"
  region      = var.region
  schedule    = "*/15 * * * *"
  time_zone   = "America/Sao_Paulo"
  description = "Executa o job odin-jobs (rotinas do Odin)"
  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/odin-jobs:run"
    oauth_token { service_account_email = var.sa["sa-tick"] }
  }
  depends_on = [google_cloud_run_v2_job_iam_member.tick_executa]
}

# Disjuntor de custo: recebe o aviso do orçamento (push com identidade) e fecha o ingress dos serviços públicos a 300%.
resource "google_project_iam_custom_role" "disjuntor" {
  role_id     = "odinDisjuntor"
  title       = "Odin: disjuntor de custo"
  description = "Só lê e atualiza serviços do Cloud Run (para fechar o ingress)."
  permissions = ["run.services.get", "run.services.update", "run.operations.get"]
}
resource "google_cloud_run_v2_service_iam_member" "disjuntor_atualiza" {
  for_each = { sts = google_cloud_run_v2_service.sts.name, mcp = google_cloud_run_v2_service.mcp.name }
  location = var.region
  name     = each.value
  role     = google_project_iam_custom_role.disjuntor.id
  member   = "serviceAccount:${var.sa["sa-disjuntor"]}"
}
resource "google_service_account_iam_member" "disjuntor_age_como" {
  for_each           = toset(["sa-sts", "sa-mcp"])
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.sa[each.value]}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.sa["sa-disjuntor"]}"
}
resource "google_cloud_run_v2_service" "disjuntor" {
  name                = "odin-disjuntor"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  template {
    service_account = var.sa["sa-disjuntor"]
    timeout         = "60s"
    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = 1
    }
    containers {
      image = var.imagem
      args  = ["apps/disjuntor/src/main.ts"]
      resources {
        limits   = { cpu = "1", memory = "256Mi" }
        cpu_idle = true
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "REGIAO"
        value = var.region
      }
      env {
        name  = "SERVICOS"
        value = join(",", local.servicos_publicos)
      }
    }
  }
}
resource "google_cloud_run_v2_service_iam_member" "disjuntor_recebe_push" {
  location = var.region
  name     = google_cloud_run_v2_service.disjuntor.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.sa["sa-disjuntor"]}"
}
resource "google_pubsub_subscription" "disjuntor" {
  name                 = "budget-alerts-disjuntor"
  topic                = var.topico_orcamento
  ack_deadline_seconds = 30
  push_config {
    push_endpoint = google_cloud_run_v2_service.disjuntor.uri
    oidc_token {
      service_account_email = var.sa["sa-disjuntor"]
      audience              = google_cloud_run_v2_service.disjuntor.uri
    }
  }
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}

output "urls" {
  value = { sts = local.url_sts, mcp = local.url_mcp, disjuntor = google_cloud_run_v2_service.disjuntor.uri }
}
