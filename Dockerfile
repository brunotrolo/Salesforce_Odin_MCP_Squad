# Uma imagem para os serviços e os jobs do Odin; o que roda é decidido pelo argumento (ver infra/modules/run).
FROM node:22-slim
ENV NODE_ENV=production NODE_NO_WARNINGS=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY apps ./apps
COPY packages ./packages
COPY schemas ./schemas
COPY catalog ./catalog
COPY scripts/lib ./scripts/lib
USER node
ENTRYPOINT ["node"]
CMD ["apps/mcp-server/src/main.ts"]
