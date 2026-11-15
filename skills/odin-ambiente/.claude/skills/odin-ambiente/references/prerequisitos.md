# Pré-requisitos por skill

| Ferramenta | Quem precisa | Como instalar | Como conferir |
|---|---|---|---|
| Node 20 ou mais novo | Todas (scripts das skills) | Instalador oficial do Node, versão LTS | `node --version` |
| Git | Todas | Instalador oficial do Git | `git --version` |
| Salesforce CLI (`sf`) | Journey Developer, LWC Developer, Apex Callouts Developer, Apex Cover Loop, Test Automator, Deep Debugger, Archaeologist | `npm install --global @salesforce/cli` | `sf --version` |
| Org padrão autenticada | As mesmas do `sf` | `sf org login web --alias <apelido> --set-default` | `sf org display` |
| Navegador do Playwright | Test Automator | `npx playwright install chromium` | O verificador procura o navegador instalado |

## Regras
- A org padrão precisa ser **sandbox ou scratch**. O odin-guard bloqueia implantação e alteração de dados em produção.
- No Windows, use o PowerShell ou o terminal do VS Code; não é preciso WSL.
- Credenciais do `sf` e do Jira ficam na sua máquina. O Odin não as lê.
