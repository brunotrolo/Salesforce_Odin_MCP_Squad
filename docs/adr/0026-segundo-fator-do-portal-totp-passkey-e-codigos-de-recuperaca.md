# 0026. Segundo fator do portal: TOTP, passkey e codigos de recuperacao, F7 e F8

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F2, F7, F8
**Documentos afetados:** docs/seguranca/02-autenticacao-e-mfa.md; docs/seguranca/11-runbooks.md; docs/RUNBOOKS-OPERACIONAIS.md; docs/MANUAL-DO-PORTAL.md

## Contexto
O portal interino (ADR 0023/0024) só tinha o segundo fator do próprio GitHub, que o Odin não consegue verificar. A F2 pede segundo fator próprio (TOTP, passkey, códigos de recuperação) com reautenticação recente. A F7 pede busca semântica real (embeddings da Vertex AI) e a F8, auditoria em BigQuery, painel, alertas e runbooks.

## Decisão
1. **Segundo fator no portal:** TOTP (RFC 6238, janela ±30 s, passo usado não se repete), 10 códigos de recuperação de uso único (guardados só como HMAC), passkey WebAuthn (ES256, atestação "none", exige presença e verificação do usuário, contador crescente). Sessão de pessoa real só abre `/admin` e `/conta` com fator confirmado há no máximo 15 minutos. Com `MFA_EXIGIR` (padrão) o cadastro é obrigatório; quem já cadastrou sempre confirma. O segredo TOTP fica cifrado (AES-256-GCM, chave derivada da pimenta). Administrador zera o fator de uma pessoa (perda do aparelho).
2. **Exceção documentada:** o segredo de administração (conta de emergência, "break-glass") não exige segundo fator; é auditado e deve ser trocado após o uso.
3. **F7:** embeddings `text-embedding-005` (256 dimensões, `us-central1`) calculados na indexação; busca híbrida 0,65 cosseno + 0,35 léxico com corte `KB_CORTE_HIBRIDO`; medição de recuperação (recall@5 ≥ 80%) na homologação (H30). A fonte do conhecimento fica em `conhecimento/` deste repositório até o repositório `odin-knowledge` poder ser criado.
4. **F8:** sink de logs para o dataset BigQuery `odin_auditoria` (400 dias), painel operacional, três alertas (5xx, latência, negações) e runbooks ROP-01..04.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Biblioteca de WebAuthn/CBOR | Mais dependências na cadeia de suprimentos; o necessário cabe em ~100 linhas testadas com autenticador de software. |
| Chave KMS `campos` para cifrar o TOTP | Mais uma chamada de rede por login; a derivação da pimenta basta no estágio E0. Revisar na F9. |
| SMS ou e-mail como fator | Fracos e dependentes de terceiros. |

## Consequências
- Quem perder todos os fatores precisa que um administrador zere o fator e entre de novo (convite).
- Sessões já com fator confirmado seguem válidas por até 15 minutos depois de um reset.
- Atestação de passkey não é verificada (qualquer autenticador); aceitável para uso interno.
- A passkey no navegador real (Windows Hello, Touch ID) só é provada pela pessoa; o servidor é provado com autenticador de software.

## Segurança
Reduz o risco de sessão roubada e de convite vazado. Controles: limite de taxa por pessoa, desafios de uso único com validade de 5 min, origem e rpId conferidos, auditoria `portal.mfa.*`.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [ ] Testes de conformidade (scripts/conformidade.mjs), se a regra é verificável
