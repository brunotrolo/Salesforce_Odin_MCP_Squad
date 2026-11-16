# F8: auditoria em BigQuery (sink de logs), painel e alertas. Custo mínimo: tabela particionada com expiração de 400 dias.
variable "project_id" { type = string }
variable "region" { type = string }
variable "email_alerta" {
  type    = string
  default = ""
}

resource "google_bigquery_dataset" "auditoria" {
  dataset_id                  = "odin_auditoria"
  location                    = var.region
  default_table_expiration_ms = 34560000000 # 400 dias
  delete_contents_on_destroy  = false
}

resource "google_logging_project_sink" "auditoria" {
  name                   = "odin-auditoria"
  destination            = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.auditoria.dataset_id}"
  filter                 = "resource.type=\"cloud_run_revision\" AND (jsonPayload.evento:* OR severity>=WARNING)"
  unique_writer_identity = true
  bigquery_options { use_partitioned_tables = true }
}

resource "google_bigquery_dataset_iam_member" "sink" {
  dataset_id = google_bigquery_dataset.auditoria.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.auditoria.writer_identity
}

resource "google_monitoring_notification_channel" "email" {
  count        = var.email_alerta == "" ? 0 : 1
  display_name = "odin-alertas"
  type         = "email"
  labels       = { email_address = var.email_alerta }
}

locals { canais = [for c in google_monitoring_notification_channel.email : c.id] }

resource "google_monitoring_alert_policy" "erros_5xx" {
  display_name = "Odin: erros 5xx nos serviços (ROP-01)"
  combiner     = "OR"
  conditions {
    display_name = "5xx > 5 em 5 min"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
  notification_channels = local.canais
}

resource "google_monitoring_alert_policy" "latencia" {
  display_name = "Odin: latência p95 alta (ROP-02)"
  combiner     = "OR"
  conditions {
    display_name = "p95 > 2 s por 10 min"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 2000
      duration        = "600s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }
  notification_channels = local.canais
}

resource "google_monitoring_alert_policy" "negacoes" {
  display_name = "Odin: pico de acessos negados (ROP-03)"
  combiner     = "OR"
  conditions {
    display_name = "4xx > 50 em 5 min"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"4xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 50
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
  notification_channels = local.canais
}

resource "google_monitoring_dashboard" "odin" {
  dashboard_json = jsonencode({
    displayName = "Odin: visão operacional"
    mosaicLayout = {
      columns = 12
      tiles = [
        { width = 6, height = 4, widget = { title = "Requisições por serviço", xyChart = { dataSets = [{ timeSeriesQuery = { timeSeriesFilter = { filter = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\"", aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", groupByFields = ["resource.label.service_name"], crossSeriesReducer = "REDUCE_SUM" } } } }] } } },
        { xPos = 6, width = 6, height = 4, widget = { title = "Latência p95 (ms)", xyChart = { dataSets = [{ timeSeriesQuery = { timeSeriesFilter = { filter = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\"", aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_PERCENTILE_95", groupByFields = ["resource.label.service_name"], crossSeriesReducer = "REDUCE_MAX" } } } }] } } },
        { yPos = 4, width = 6, height = 4, widget = { title = "Erros 5xx", xyChart = { dataSets = [{ timeSeriesQuery = { timeSeriesFilter = { filter = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" metric.label.response_code_class=\"5xx\"", aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_SUM", crossSeriesReducer = "REDUCE_SUM" } } } }] } } },
        { xPos = 6, yPos = 4, width = 6, height = 4, widget = { title = "Instâncias ativas", xyChart = { dataSets = [{ timeSeriesQuery = { timeSeriesFilter = { filter = "metric.type=\"run.googleapis.com/container/instance_count\" resource.type=\"cloud_run_revision\"", aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_MEAN", groupByFields = ["resource.label.service_name"], crossSeriesReducer = "REDUCE_SUM" } } } }] } } },
      ]
    }
  })
}

output "dataset_auditoria" { value = google_bigquery_dataset.auditoria.dataset_id }
