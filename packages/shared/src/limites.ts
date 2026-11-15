// Constantes de segurança e de custo, nomeadas e únicas. Mudar qualquer uma exige ADR.
export const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 min (segurança 03; CF-05)
export const REVOCATION_CACHE_SECONDS = 30; // revogação efetiva em até 30 s (CT-23)
export const MAX_TOOL_RESPONSE_TOKENS = 8000; // teto de resposta de ferramenta (plano, seção 10)
export const SKILL_TARGET_TOKENS = 5000; // alvo por SKILL.md e referência (ADR 0017)
export const MAX_SERVER_INSTRUCTIONS_CHARS = 4096;
export const OFFLINE_COPY_DAYS = 7; // modo degradado (decisão 14)
export const DEVICE_CODE_TTL_SECONDS = 600; // código de ativação: 10 min, uso único
export const REFRESH_FAMILY_MAX_DAYS = 90;
export const REFRESH_IDLE_DAYS = 30;
export const JWKS_CACHE_SECONDS = 600;
export const SIGNED_URL_TTL_SECONDS = 300;
export const ANON_RATE_PER_MIN = 30; // rotas anônimas, por IP
export const ROUTING_THRESHOLD = 0.2; // abaixo disso: "não sei" (calibrado pelo conjunto de intenções)
export const QUOTA_FLUSH_SECONDS = 30;
export const QUOTA_FLUSH_CALLS = 20;
