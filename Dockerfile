# Imagem sem segredos: nenhum ARG/ENV de credencial e nenhum .env no contexto de
# build (garantido pelo .dockerignore). A configuracao chega em runtime.
FROM node:20-alpine

WORKDIR /app

# Camada de dependencias separada do codigo para reaproveitar cache.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=3000

# Menor privilegio: o processo nao roda como root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/app.js"]