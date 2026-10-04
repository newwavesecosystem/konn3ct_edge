FROM node:20-bookworm-slim AS builder

# Install build dependencies for mediasoup (Python 3, C++ compiler) with retries
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends apt-transport-https ca-certificates; \
    for i in 1 2 3 4 5; do \
      apt-get update && DEBIAN_FRONTEND=noninteractive \
        apt-get install -y --no-install-recommends -o Acquire::Retries=3 --fix-missing \
          python3 \
          python3-pip \
          build-essential && break || sleep $((i*2)); \
    done; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production Image ---
FROM node:20-bookworm-slim

# Mediasoup requires python3 runtime for some internal tasks, ffmpeg for transcription
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends apt-transport-https ca-certificates; \
    for i in 1 2 3 4 5; do \
      apt-get update && DEBIAN_FRONTEND=noninteractive \
        apt-get install -y --no-install-recommends -o Acquire::Retries=3 --fix-missing \
          python3 \
          ffmpeg && break || sleep $((i*2)); \
    done; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/swagger.yaml ./swagger.yaml

ENV NODE_ENV=production
ENV PORT=3000

# Expose HTTP/WS port
EXPOSE 3000

# Expose WebRTC UDP/TCP Ports for Mediasoup
EXPOSE 10000-59999/udp
EXPOSE 10000-59999/tcp

CMD ["node", "dist/server.js"]
