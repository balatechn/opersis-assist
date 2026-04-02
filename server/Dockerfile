# ── Opersis Assist — Backend Server ──

# ── Stage 1: Build the Windows agent exe ──
FROM node:20-alpine AS agent-builder
WORKDIR /agent
COPY agent/package.json ./
RUN npm install --production
RUN npm install -g @yao-pkg/pkg
COPY agent/src ./src
RUN pkg --targets node20-win-x64 --output dist/opersis-assist-agent.exe . \
    && ls -la dist/

# ── Stage 2: Build the server ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY server/package.json ./
RUN npm install --production
COPY server/src ./src

# ── Stage 3: Final image ──
FROM node:20-alpine
RUN apk add --no-cache wget \
    && addgroup -g 1001 opersis \
    && adduser -u 1001 -G opersis -s /bin/sh -D opersis
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=agent-builder /agent/dist/opersis-assist-agent.exe ./agent-dist/opersis-assist-agent.exe
RUN mkdir -p logs && chown -R opersis:opersis /app
USER opersis
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "src/index.js"]
