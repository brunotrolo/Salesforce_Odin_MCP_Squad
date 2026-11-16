# Ambiente poc, estágio E0 (docs/arquitetura/05-custos-e-finops.md). Aplicado só pelo workflow infra.yml (identidade federada, sem chave).
terraform {
  required_version = ">= 1.9"
  required_providers { google = { source = "hashicorp/google", version = "~> 6.0" } }
  backend "gcs" {
    bucket = "salesforcemcpodin-tfstate" # criado pelo próprio workflow antes do init
    prefix = "poc"
  }
}

locals {
  estagio = "e0"
}

variable "project_id" {
  type    = string
  default = "salesforcemcpodin"
}
variable "region" {
  type    = string
  default = "southamerica-east1"
}
variable "billing_account" {
  type    = string
  default = "01A65F-62F735-7F6904"
}
# A moeda e o valor vêm do workflow (a moeda do orçamento precisa ser a da conta de faturamento): US$ 5 em E0.
variable "moeda" {
  type    = string
  default = "USD"
}
variable "orcamento" {
  type    = string
  default = "5"
}

provider "google" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

module "apis" {
  source = "../../modules/apis"
}

# Orçamento e canal de alerta primeiro: nada é criado antes do teto de custo (decisão 45).
module "finops" {
  source          = "../../modules/finops"
  project_id      = var.project_id
  billing_account = var.billing_account
  moeda           = var.moeda
  orcamento       = var.orcamento
  depends_on      = [module.apis]
}

module "security" {
  source     = "../../modules/security"
  project_id = var.project_id
  region     = var.region
  depends_on = [module.apis, module.finops]
}

module "data" {
  source       = "../../modules/data"
  project_id   = var.project_id
  region       = var.region
  sa_ci_signer = module.security.sa["sa-ci-signer"]
  sa_publisher = module.security.sa["sa-publisher"]
  sa_mcp       = module.security.sa["sa-mcp"]
  sa_indexer   = module.security.sa["sa-indexer"]
  sa_portal    = module.security.sa["sa-portal"]
  depends_on   = [module.apis, module.finops]
}

module "registry" {
  source     = "../../modules/registry"
  project_id = var.project_id
  region     = var.region
  depends_on = [module.apis, module.finops]
}

output "contas_de_servico" { value = module.security.sa }
output "chaves_kms" { value = module.security.chaves }
output "buckets" { value = module.data.buckets }
output "topico_orcamento" { value = module.finops.topico }
