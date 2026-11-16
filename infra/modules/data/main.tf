# Firestore (identidade, acesso, catálogo, RAG da PoC) e buckets privados. Sem Cloud SQL em E0 (CF-12).
variable "project_id" { type = string }
variable "region" { type = string }
variable "sa_ci_signer" { type = string }
variable "sa_publisher" { type = string }
variable "sa_mcp" { type = string }
variable "sa_indexer" { type = string }
variable "sa_portal" { type = string }

resource "google_firestore_database" "padrao" {
  name                    = "(default)"
  location_id             = var.region
  type                    = "FIRESTORE_NATIVE"
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"
}

locals {
  buckets = {
    bundles   = "${var.project_id}-bundles"
    snapshots = "${var.project_id}-kb-snapshots"
    cli       = "${var.project_id}-cli"
  }
}

resource "google_storage_bucket" "b" {
  for_each                    = local.buckets
  name                        = each.value
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning { enabled = true }
  # Versões antigas não acumulam custo: pacotes têm retenção de 365 dias, snapshots de 180.
  lifecycle_rule {
    condition {
      days_since_noncurrent_time = each.key == "snapshots" ? 180 : 365
      with_state                 = "ARCHIVED"
    }
    action { type = "Delete" }
  }
}

resource "google_storage_bucket_iam_member" "ci_grava_pacotes" {
  bucket = google_storage_bucket.b["bundles"].name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${var.sa_ci_signer}"
}
resource "google_storage_bucket_iam_member" "publisher_le_pacotes" {
  bucket = google_storage_bucket.b["bundles"].name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.sa_publisher}"
}
resource "google_storage_bucket_iam_member" "mcp_le_pacotes" {
  bucket = google_storage_bucket.b["bundles"].name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.sa_mcp}"
}
resource "google_storage_bucket_iam_member" "indexer_snapshots" {
  bucket = google_storage_bucket.b["snapshots"].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.sa_indexer}"
}
resource "google_storage_bucket_iam_member" "portal_serve_cli" {
  bucket = google_storage_bucket.b["cli"].name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.sa_portal}"
}

output "buckets" { value = { for k, v in google_storage_bucket.b : k => v.name } }
