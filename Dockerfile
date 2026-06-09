FROM node:20-bullseye-slim AS builder

# Install build dependencies for mediasoup (Python 3, C++ compiler)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production Image ---
FROM node:20-bullseye-slim

# Mediasoup requires python3 runtime for some internal tasks, ffmpeg for transcription
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

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
