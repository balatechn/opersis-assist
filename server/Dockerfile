# ── Opersis Assist — Backend Server ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src ./src
COPY agent-installer ./agent-installer

FROM node:20-alpine
RUN apk add --no-cache wget \
    && addgroup -g 1001 opersis \
    && adduser -u 1001 -G opersis -s /bin/sh -D opersis
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/agent-installer ./agent-installer
COPY --from=builder /app/package.json ./
RUN mkdir -p logs && chown -R opersis:opersis /app
USER opersis
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "src/index.js"]
