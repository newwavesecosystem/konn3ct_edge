# 01 Current Architecture Inventory
Current State: Monolithic Node.js server (`server.ts`) running both WebSocket signaling and Mediasoup C++ worker orchestration (`sfu.ts`).
- Signaling: `ws` library on `http.Server`
- Media: `mediasoup` 3.x
- DB: `ioredis` and `prisma/postgresql`
