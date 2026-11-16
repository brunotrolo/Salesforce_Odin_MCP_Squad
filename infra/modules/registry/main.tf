variable "project_id" { type = string }
variable "region" { type = string }

resource "google_artifact_registry_repository" "imagens" {
  location      = var.region
  repository_id = "odin-images"
  format        = "DOCKER"
  description   = "Imagens dos serviços do Odin"
  # Limpeza automática: imagens antigas são o custo silencioso mais comum (CF-14).
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "apagar-sem-tag"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s"
    }
  }
  cleanup_policies {
    id     = "manter-tres-ultimas"
    action = "KEEP"
    most_recent_versions { keep_count = 3 }
  }
}
