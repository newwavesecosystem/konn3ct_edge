# Conn3ct Meeting Backend (`src`)

This directory contains the primary backend service for the **Conn3ct Meeting** application. It serves as an Express.js API, a WebSocket signaling server, and a Mediasoup Selective Forwarding Unit (SFU) for handling WebRTC media streams.

## 🏗 Directory Structure

- `server.ts`: The main entrypoint. Bootstraps the Express application, configures middleware (CORS, Helmet, Rate Limiting), attaches API routes, initializes the WebSocket server for signaling, and spins up Mediasoup worker processes.
- `routes/`: Express API endpoints organized by feature (Auth, Teams, Rooms, Recordings, Payments, Scheduling, Telephony, Streaming, AI, etc.).
- `media/`: Core Mediasoup SFU logic. Contains configurations, worker management, and specialized media handling like real-time transcription.
- `signaling/`: WebSocket-based signaling server (`server.ts`) for managing WebRTC room state, peer connections, chat, and other real-time events.
- `services/`: Core business logic and external integrations (e.g., S3 signed URLs, external recording launchers).
- `middleware/`: Express middleware, including global and specific rate limiters.
- `utils/`: Common utility functions and helpers.
- `ai/`: Services handling AI integrations.
- `notifications/`: Email or webhook notifications logic.
- `scaling/`: Logic pertaining to multi-node scaling or clustering.
- `__tests__/`: Contains automated tests ensuring codebase reliability.

## 🚀 Tech Stack

- **Node.js + Express**: HTTP API Server.
- **Mediasoup**: Next-generation WebRTC SFU for handling audio, video, and screen sharing at scale.
- **WebSockets (`ws`)**: Low-latency signaling for room and peer state synchronization.
- **Prisma ORM**: Database interactions (configured via `db.ts`).
- **TypeScript**: Strictly-typed codebase for high reliability.
- **Swagger**: OpenAPI documentation generated via `swagger.yaml` (accessible at `/api-docs` in non-prod).

## ⚙️ Core Components

### 1. HTTP API Server (`server.ts` & `routes/`)
Provides standard REST endpoints. Handled by Express, secured by Helmet, and rate-limited. Handles authentication, room metadata management, and integrations with external services (like Stripe for payments or OpenAI for transcription).

### 2. Mediasoup SFU (`media/`)
When the server boots, it creates Mediasoup `Worker` processes depending on the CPU core count. The workers handle the heavy lifting of routing UDP/TCP media packets to peers without requiring a full mesh architecture, dramatically improving client-side performance.

### 3. Signaling Server (`signaling/`)
A custom WebSocket implementation attached to the Express HTTP server. It listens for connections and orchestrates the WebRTC handshake (transports, producers, consumers) between the client and Mediasoup routers.

## 🛠 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database (for Prisma)
- Environment variables configured (see root `.env` or equivalent)

### Installation
Ensure dependencies in the root project are installed:
```bash
npm install
```

### Running the Server

#### Development
To start the backend in development mode with hot-reloading (typically from the root directory):
```bash
npm run dev
```

#### Production
To build the TypeScript files and start the compiled application:
```bash
npm run build
npm start
```
*Note: In production mode, the server will dynamically detect and announce its public IP for WebRTC routing, which is essential for successful peer connections over the internet.*

## 🔒 Security & Environment
- **CORS**: Restricted primarily to allowed frontend origins based on `.env` configurations.
- **Rate Limiting**: Applied globally and to specific endpoints to prevent brute-force or DoS.
- **Secrets Check**: Production runtime requires critical secrets like `JWT_SECRET`, `TURN_SECRET`, and `EXTERNAL_API_KEY` to be set or the server will refuse to start.

## 🧪 Testing Policy
Every new feature, change, or bug fix **MUST** be accompanied by revisiting the corresponding test or creating a new one if it does not exist. High test coverage is essential.

## ⚠️ CRITICAL RULE: Audio Logic Integrity
**NEVER** modify the audio handling, autoplay unlocking, or microphone re-acquisition logic without extreme caution. The audio architecture is highly delicate and relies on specific browser hacks and precise timing. Any changes to WebRTC audio logic must be explicitly confirmed and dual-approved.
