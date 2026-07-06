# Konn3ct Recorder Worker

This directory contains the headless browser recording worker for Konn3ct. It is a Node.js background service responsible for joining meetings, capturing audio and video, processing the recordings, and uploading them to cloud storage.

## Architecture & How It Works

The recorder is a job-processing worker that connects to Redis.

1. **Job Queue:** It listens to a Redis list (`recorder:queue`) for new recording jobs.
2. **Browser Launch:** When a job is received, it launches a Google Chrome browser via Puppeteer (wrapped in Xvfb for a virtual display) and navigates to the meeting URL.
3. **Capture:** It uses a fake UI and virtual media devices to join the meeting automatically. The capture logic is injected directly into the browser context, calling `navigator.mediaDevices.getDisplayMedia()` to capture the screen and audio.
4. **Chunking & Streaming:** The video is recorded as WebM chunks using the `MediaRecorder` API. To bypass Puppeteer's slow IPC channel, these chunks are sent directly to a local ephemeral HTTP server running within the worker process, which writes them to a raw `.webm` file.
5. **Transcoding:** Upon receiving a stop signal via Redis Pub/Sub (`recorder:stop:<roomId>`), the browser is closed. The worker then spawns a background `transcoder.js` process.
6. **Upload & Notification:** `transcoder.js` uses `fluent-ffmpeg` to convert the raw `.webm` recording to `.mp4` and uploads it to an S3-compatible object storage (e.g., DigitalOcean Spaces). Callbacks are sent to the `BACKEND_URL` to update the recording status (started, transcoding, uploading, completed, or failed).

## Tech Stack

- **Node.js:** v22
- **Puppeteer & Xvfb:** For headless Chrome rendering and capture
- **FFmpeg:** For fast `.webm` to `.mp4` transcoding (`fluent-ffmpeg`)
- **Redis (`ioredis`):** For job queuing, pub/sub, and concurrency leasing
- **AWS SDK (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`):** For cloud storage uploads (S3 / DO Spaces)
- **Docker:** Packaged as a Bullseye-slim Debian image with all required display servers and fonts

## Setup & Running

### Environment Variables

You need to provide the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Connection string for Redis | `redis://localhost:6379` |
| `BACKEND_URL` | URL of the Konn3ct backend to receive callbacks | `http://localhost:3000` |
| `MAX_CONCURRENT_BROWSERS` | Max simultaneous Chrome instances | `2` |
| `MAX_CONCURRENT_TRANSCODES` | Max simultaneous ffmpeg processes | `4` |
| `DO_SPACES_ENDPOINT` | Storage endpoint (S3 compatible) | `sfo3.digitaloceanspaces.com` |
| `DO_SPACES_REGION` | Storage region | `sfo3` |
| `DO_SPACES_KEY` | Storage Access Key | *(required)* |
| `DO_SPACES_SECRET` | Storage Secret Key | *(required)* |
| `DO_SPACES_BUCKET` | Storage Bucket Name | `konn3ct-assets` |

### Running Locally

To run the worker locally without Docker (requires Linux with Xvfb and Chrome/FFmpeg installed, or macOS with adjustments):

```bash
npm install
node index.js
```

### Running with Docker

The recommended way to run this component is using Docker, as it encapsulates all the necessary OS-level dependencies (Xvfb, fonts, Chrome, ffmpeg).

```bash
docker build -t konn3ct-recorder .
docker run --env-file .env konn3ct-recorder
```
*Note: The Docker container uses `xvfb-run` to provide a virtual framebuffer (`1920x1080x24`) for Chrome.*

## Key Files

- `index.js`: Main worker loop, Puppeteer lifecycle management, and HTTP chunk server.
- `transcoder.js`: Isolated process for `ffmpeg` operations and multi-part S3 uploading.
- `Dockerfile`: Debian-based environment containing Xvfb, fonts, Chrome, and FFmpeg.
- `silent.wav`: Used as a dummy audio input (`--use-file-for-fake-audio-capture`) to satisfy browser microphone requirements.

## Troubleshooting

- **Transcoding taking too long:** The transcode uses the `veryfast` preset with `libx264`. If CPU limits are hit, consider horizontally scaling the worker or reducing `MAX_CONCURRENT_TRANSCODES`.
- **Black Screen / No Audio:** Check the `silent.wav` file and ensure `--autoplay-policy=no-user-gesture-required` and the fake UI flags are present. Ensure Xvfb is running if not using headless mode.
- **Connection Refused on Callbacks:** If running in Kubernetes, ensure `BACKEND_URL` is set to the internal service DNS (e.g., `http://conn3ct-backend-service:80`).
