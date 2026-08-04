# Konn3ct Meeting Platform

Konn3ct is an advanced, high-performance web-based video conferencing platform. It supports scalable multiparty meetings, AI-powered transcription and summarization, headless cloud recording, and RTMP streaming.

## Project Structure

The repository is structured as a monorepo containing several interconnected microservices and applications:

- **[`frontend/`](./frontend/README.md)**: The Next.js React frontend. Handles user authentication, dashboards, WebRTC meeting rooms (Mediasoup client), virtual backgrounds (MediaPipe), and real-time signaling.
- **[`src/`](./src/README.md)**: The core backend Node.js/Express server. Manages REST APIs, WebSocket signaling, and the Mediasoup Selective Forwarding Unit (SFU) for scaling audio/video routing.
- **[`recorder/`](./recorder/README.md)**: A Node.js Puppeteer worker that acts as a headless browser participant. It joins meetings, captures canvas and audio, chunks it, and uses FFmpeg to encode and upload MP4s to S3/DO Spaces.
- **[`streaming-worker/`](./streaming-worker/README.md)**: A headless browser worker similar to the recorder, but designed for forwarding the meeting canvas to external RTMP destinations (like YouTube or Facebook Live).
- **[`prisma/`](./prisma/README.md)**: Contains the PostgreSQL database schema and migrations. It manages data models for Users, Rooms, Meetings, Chat, Q&A, Polls, and AI features.
- **[`k8s/`](./k8s/README.md)**: Kubernetes deployment manifests. Contains configuration for deploying the frontend, backend, workers, Redis, and ingress controllers to production clusters (DigitalOcean).
- **[`docs/`](./docs/README.md)**: Comprehensive business, marketing, technical, and architectural documentation.
- **[`scripts/`](./scripts/README.md)**: Utility and database seeding scripts for development and CI testing.
- **`konn3ct-mobile/`**: The mobile application implementation (documentation excluded from this overview).

## Tech Stack

- **Frontend**: Next.js (React), Tailwind CSS, Zustand, Mediasoup-Client, MediaPipe (Vision/Canvas processing), Playwright.
- **Backend**: Node.js, Express, Mediasoup (SFU), WebSocket (ws), Prisma ORM, Zod.
- **Workers**: Puppeteer, FFmpeg, Xvfb, AWS SDK (S3).
- **Infrastructure**: PostgreSQL, Redis (Pub/Sub and Caching), Docker, Kubernetes, GitHub Actions.
- **AI Integrations**: OpenAI (Summarization), Deepgram (Live Transcription).

## Getting Started

To run the full stack locally for development:

1. **Prerequisites**: Install Node.js, Docker, and PostgreSQL.
2. **Environment**: Copy `.env.example` to `.env` and configure your database URL, Redis URL, and secret keys.
3. **Database**: Run `npx prisma db push` or `npx prisma migrate dev` to initialize the database.
4. **Backend**: Start the main signaling and API server:
   ```bash
   npm run dev
   ```
5. **Frontend**: Open a new terminal, navigate to `frontend/`, and run:
   ```bash
   cd frontend
   npm run dev
   ```
6. **Workers**: (Optional) Start Redis using Docker, then run `node index.js` inside the `recorder` and `streaming-worker` directories to enable recording and streaming features.

## Testing & Quality Assurance

All new features or bug fixes must include unit or integration tests. Run tests via Vitest from the project root:

```bash
npm run test
```

## Critical Workspace Rules

- **Audio Logic Integrity**: The WebRTC audio handling (in `frontend/lib/webrtc.ts`, `frontend/lib/meeting-context.tsx`, and `src/signaling/server.ts`) is highly sensitive. Modifying the autoplay unlock or microphone re-acquisition logic requires extreme caution and explicit review.
- **Testing Policy**: Every new feature or change must revisit existing tests or add new coverage.

For deeper technical deep-dives into specific subsystems, refer to the individual `README.md` files located in their respective directories.
