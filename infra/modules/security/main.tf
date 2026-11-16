# Contas de serviço (uma por componente, sem chaves exportadas) e chaves do Cloud KMS em software (HSM só em E2).
variable "project_id" { type = string }
variable "region" { type = string }

locals {
  contas = {
    "sa-mcp"       = "odin-mcp: orquestrador MCP e API /v1"
    "sa-sts"       = "odin-sts: emissor de tokens"
    "sa-portal"    = "odin-portal: interface e administração"
    "sa-publisher" = "job odin-publisher: registra versões"
    "sa-indexer"   = "job odin-indexer: ingestão do conhecimento"
    "sa-jobs"      = "job odin-jobs: rotinas a cada 15 min"
    "sa-tick"      = "agendador odin-tick: só executa o odin-jobs"
    "sa-disjuntor" = "função odin-disjuntor: fecha o ingress a 300% do orçamento"
    "sa-ci-signer" = "CI: assina pacotes (só workflow publish.yml em main)"
    "sa-ci-deploy" = "CI: implanta serviços (só workflow deploy.yml)"
  }
}

resource "google_service_account" "sa" {
  for_each     = local.contas
  account_id   = each.key
  display_name = each.value
}

resource "google_kms_key_ring" "odin" {
  name     = "odin"
  location = var.region
}

resource "google_kms_crypto_key" "bundle_signing" {
  name     = "bundle-signing"
  key_ring = google_kms_key_ring.odin.id
  purpose  = "ASYMMETRIC_SIGN"
  version_template {
    algorithm        = "EC_SIGN_P256_SHA256"
    protection_level = "SOFTWARE"
  }
  lifecycle { prevent_destroy = true }
}
resource "google_kms_crypto_key" "cli_signing" {
  name     = "cli-signing"
  key_ring = google_kms_key_ring.odin.id
  purpose  = "ASYMMETRIC_SIGN"
  version_template {
    algorithm        = "EC_SIGN_P256_SHA256"
    protection_level = "SOFTWARE"
  }
  lifecycle { prevent_destroy = true }
}
resource "google_kms_crypto_key" "jwt_signing" {
  name     = "jwt-signing"
  key_ring = google_kms_key_ring.odin.id
  purpose  = "ASYMMETRIC_SIGN"
  version_template {
    algorithm        = "EC_SIGN_P256_SHA256"
    protection_level = "SOFTWARE"
  }
  lifecycle { prevent_destroy = true }
}
resource "google_kms_crypto_key" "campos" {
  name            = "campos"
  key_ring        = google_kms_key_ring.odin.id
  purpose         = "ENCRYPT_DECRYPT"
  rotation_period = "31536000s"
  lifecycle { prevent_destroy = true }
}

# Mínimo privilégio, no recurso e não no projeto.
resource "google_kms_crypto_key_iam_member" "ci_assina_pacotes" {
  crypto_key_id = google_kms_crypto_key.bundle_signing.id
  role          = "roles/cloudkms.signerVerifier"
  member        = "serviceAccount:${google_service_account.sa["sa-ci-signer"].email}"
}
resource "google_kms_crypto_key_iam_member" "publisher_confere_pacotes" {
  crypto_key_id = google_kms_crypto_key.bundle_signing.id
  role          = "roles/cloudkms.publicKeyViewer"
  member        = "serviceAccount:${google_service_account.sa["sa-publisher"].email}"
}
resource "google_kms_crypto_key_iam_member" "ci_assina_cli" {
  crypto_key_id = google_kms_crypto_key.cli_signing.id
  role          = "roles/cloudkms.signerVerifier"
  member        = "serviceAccount:${google_service_account.sa["sa-ci-signer"].email}"
}
resource "google_kms_crypto_key_iam_member" "sts_assina_tokens" {
  crypto_key_id = google_kms_crypto_key.jwt_signing.id
  role          = "roles/cloudkms.signerVerifier"
  member        = "serviceAccount:${google_service_account.sa["sa-sts"].email}"
}
resource "google_kms_crypto_key_iam_member" "sts_cifra_campos" {
  crypto_key_id = google_kms_crypto_key.campos.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.sa["sa-sts"].email}"
}
resource "google_kms_crypto_key_iam_member" "mcp_verifica_tokens" {
  crypto_key_id = google_kms_crypto_key.jwt_signing.id
  role          = "roles/cloudkms.publicKeyViewer"
  member        = "serviceAccount:${google_service_account.sa["sa-mcp"].email}"
}

output "sa" { value = { for k, v in google_service_account.sa : k => v.email } }
output "chaves" {
  value = {
    bundle_signing = google_kms_crypto_key.bundle_signing.id
    cli_signing    = google_kms_crypto_key.cli_signing.id
    jwt_signing    = google_kms_crypto_key.jwt_signing.id
    campos         = google_kms_crypto_key.campos.id
  }
}
