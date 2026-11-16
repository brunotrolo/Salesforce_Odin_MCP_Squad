# APIs mínimas do estágio E0. Habilitar API não custa nada; o que custa é o recurso criado.
locals {
  apis = [
    "serviceusage.googleapis.com", "cloudresourcemanager.googleapis.com", "iam.googleapis.com", "iamcredentials.googleapis.com",
    "billingbudgets.googleapis.com", "cloudbilling.googleapis.com", "pubsub.googleapis.com", "cloudkms.googleapis.com",
    "firestore.googleapis.com", "storage.googleapis.com", "artifactregistry.googleapis.com", "run.googleapis.com",
    "cloudscheduler.googleapis.com", "secretmanager.googleapis.com", "logging.googleapis.com", "monitoring.googleapis.com",
    "bigquery.googleapis.com", "aiplatform.googleapis.com", "cloudbuild.googleapis.com", "eventarc.googleapis.com",
  ]
}
resource "google_project_service" "api" {
  for_each           = toset(local.apis)
  service            = each.value
  disable_on_destroy = false
}
