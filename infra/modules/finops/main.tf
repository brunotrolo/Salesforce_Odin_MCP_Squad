# Teto de custo: orçamento com alertas em 50%, 90%, 100%, 200% e 300% e tópico que aciona o disjuntor (arquitetura 05, seção 5).
variable "project_id" { type = string }
variable "billing_account" { type = string }
variable "moeda" { type = string }
variable "orcamento" { type = string }

data "google_project" "p" { project_id = var.project_id }

resource "google_pubsub_topic" "budget_alerts" {
  name = "budget-alerts"
}

resource "google_billing_budget" "orcamento" {
  billing_account = var.billing_account
  display_name    = "${var.project_id}-budget"
  budget_filter {
    projects = ["projects/${data.google_project.p.number}"]
  }
  amount {
    specified_amount {
      currency_code = var.moeda
      units         = var.orcamento
    }
  }
  dynamic "threshold_rules" {
    for_each = [0.5, 0.9, 1.0, 2.0, 3.0]
    content { threshold_percent = threshold_rules.value }
  }
  all_updates_rule {
    pubsub_topic   = google_pubsub_topic.budget_alerts.id
    schema_version = "1.0"
  }
}

output "topico" { value = google_pubsub_topic.budget_alerts.id }
