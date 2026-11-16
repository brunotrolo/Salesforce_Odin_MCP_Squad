# Base de conhecimento do Odin (fonte do RAG)

Conteúdo **fictício de demonstração** (squad-atendimento, projeto-atlas). Esta pasta tem o formato do repositório `odin-knowledge` (plano, seção 11): arquivos markdown com frontmatter, uma pasta por coleção.
Quando o repositório `odin-knowledge` existir, esta pasta passa a ser só exemplo. Conhecimento real de cliente **não** entra neste repositório público.
Pipeline: `scripts/indexar-conhecimento.ts` valida, mascara PII, divide por seção, gera os embeddings e grava no Firestore.
