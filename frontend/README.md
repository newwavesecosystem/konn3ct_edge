# Conn3ct Meeting - Frontend

This is the frontend application for Conn3ct Meeting, built with Next.js, React, and TypeScript. It provides a rich, interactive video conferencing experience featuring WebRTC integration (via Mediasoup) and AI-powered virtual backgrounds (via MediaPipe).

## 🚀 Tech Stack

- **Framework:** Next.js (v16), React (v19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (v4), Framer Motion
- **State Management:** Zustand
- **WebRTC:** `mediasoup-client`
- **Signaling:** `socket.io-client`
- **AI/Vision:** `@mediapipe/tasks-vision` (for virtual backgrounds)
- **Forms & Validation:** `react-hook-form`, Zod
- **Icons:** `lucide-react`
- **Testing:** Playwright (E2E)

## 📁 Key Directories

- `app/` - Next.js App Router pages and layouts.
- `components/` - Reusable React components (UI elements, meeting controls, video tiles).
- `hooks/` - Custom React hooks (e.g., WebRTC state, audio/video handling).
- `lib/` - Utility functions, WebRTC managers, signaling logic.
- `e2e/` - Playwright end-to-end tests.
- `public/` - Static assets, including MediaPipe models for background segmentation.
- `types/` - TypeScript type definitions.

## 🛠️ Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm or yarn or pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file in the root of the `frontend` directory based on your configuration requirements (e.g., API URLs, Socket URLs).

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Building for Production

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## 🧪 Testing

End-to-end tests are configured using Playwright.

Run E2E tests:
```bash
npm run test:e2e
```

## ⚠️ Important Rules & Considerations

- **Audio Logic Integrity:** The audio handling, autoplay unlocking, and microphone re-acquisition logic in files like `webrtc.ts`, `server.ts`, and `meeting-context.tsx` are critical and highly sensitive. **Never modify these without explicit authorization.**
- **Testing Policy:** Every new feature, change, or bug fix MUST be accompanied by revisiting the corresponding test or creating a new one if it does not exist.

## 🌐 Features Overview

- Multi-party video conferencing powered by Mediasoup SFU.
- Real-time signaling via Socket.io.
- Client-side virtual background and background blurring using MediaPipe segmenter.
- Modern, responsive UI with Tailwind CSS.
- Audio context and device management.
