# Konn3ct Streaming Worker

A scalable, headless browser worker for Konn3ct that joins meetings as a bot, captures the audio/video stream, and simulcasts it to RTMP targets (like YouTube, Facebook, or Twitch).

## Architecture & How It Works

1. **Task Queue:** The worker listens for new streaming jobs on a Redis queue (`streamer:queue`).
2. **Authentication:** It generates a short-lived bot JWT using `JWT_SECRET` to authenticate with the meeting room without requiring a real user account.
3. **Browser Capture:** It launches a Puppeteer instance (with Chrome) using `Xvfb` (Virtual Framebuffer). `puppeteer-stream` requires a non-headless browser to successfully capture tab audio and video, hence the need for Xvfb in server environments.
4. **Media Encoding & Simulcast:** The captured browser stream is piped directly into a spawned `ffmpeg` process. FFmpeg encodes the stream (H.264/AAC) and uses the `tee` muxer to simultaneously push the output to multiple RTMP URLs.
5. **Lifecycle Management:** It listens on a Redis Pub/Sub channel (`streamer:stop:<streamId>`) for stop signals, automatically cuts streams after 8 hours to prevent zombie processes, and reports status updates back to the main server.

## Tech Stack

- **Node.js**
- **Puppeteer** (with `puppeteer-stream` for WebRTC/Canvas tab capture)
- **FFmpeg** (for real-time H.264/AAC encoding and RTMP multiplexing)
- **Redis / ioredis** (for job queues and Pub/Sub)
- **Xvfb** (Virtual Framebuffer for running non-headless Chrome in Docker)

## Prerequisites

If running locally (without Docker), you will need:
- Node.js 22+
- Google Chrome installed locally
- FFmpeg installed and available in your system's PATH
- A running Redis server
- Xvfb (Linux only, for headless environments)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret used to sign the bot's JWT. **Must match the main server**. | *None (Required)* |
| `NODE_ENV` | Environment mode (`production` enables specific retry logic) | `development` |

## Redis Interfaces

The worker interacts with the main infrastructure through the following Redis keys and channels:

- **`streamer:queue` (List - `BRPOP`)**: The queue where new jobs are submitted. The payload expects:
  ```json
  {
    "streamId": "uuid",
    "roomId": "uuid",
    "roomSlug": "room-name",
    "rtmpUrls": ["rtmp://youtube.com/...", "rtmp://facebook.com/..."],
    "url": "https://konn3ct.internal/meeting/room-name"
  }
  ```
- **`streamer:status` (Pub/Sub - `PUBLISH`)**: The worker publishes status updates (`live`, `stopped`, `failed`) to inform the backend.
- **`streamer:stop:<streamId>` (Pub/Sub - `SUBSCRIBE`)**: The worker listens to this channel to terminate a specific active stream gracefully.

## Running the Worker

### Using Docker (Recommended)

Because of the complex system dependencies (Chrome, Xvfb, fonts, FFmpeg), it is highly recommended to use Docker.

```bash
docker build -t conn3ct-streaming-worker .
docker run -e REDIS_URL=redis://your-redis:6379 -e JWT_SECRET=your_secret conn3ct-streaming-worker
```

*The Docker image automatically configures Chrome policies to support Manifest V2 (required by `puppeteer-stream`) and starts the Node app wrapped in `xvfb-run`.*

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your `.env` file with `REDIS_URL` and `JWT_SECRET`.
3. Run the worker:
   ```bash
   npm start
   ```

> **Note:** On Mac/Windows, Puppeteer will launch a visible Chrome window since `headless: false` is required for the capture extension to work. On Linux, you must prepend `xvfb-run` if running in a headless environment.

## Troubleshooting

- **Puppeteer Chrome not found:** The script attempts to use `/usr/bin/google-chrome` or falls back to the Puppeteer bundled Chrome. Ensure Chrome is installed.
- **"FFmpeg crashed" errors:** Check that FFmpeg is installed locally and the RTMP URLs provided in the job are valid and accepting connections.
- **Audio not captured:** Ensure the Chrome autoplay policy isn't blocking audio. The worker passes `--autoplay-policy=no-user-gesture-required` to circumvent this. **Do not modify the `webrtc` or audio logic in the main meeting app**, as the bot relies on the standard participant audio rendering architecture.
