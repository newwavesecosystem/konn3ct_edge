# Konn3ct eCinema Broadcast Feature

## Overview

The **eCinema Broadcast** feature in Konn3ct allows a meeting host to share a video link, such as a YouTube link, directly inside an active video conference session. Once the host pastes the link and starts the broadcast, the video becomes visible to everyone in the meeting so participants can watch the same clip together in real time.

This feature turns a normal meeting room into a shared viewing experience. It is useful for training, online classes, webinars, product demos, entertainment sessions, marketing presentations, and any meeting where a group needs to watch the same external video together.

---

## What the Feature Does

The feature allows a host or permitted user to:

1. Open the eCinema broadcast option inside the meeting.
2. Paste a supported video link, such as a YouTube URL.
3. Click **Broadcast**.
4. Replace the normal meeting video view with the shared video player.
5. Allow all meeting participants to watch the video together.
6. Stop the broadcast when the shared viewing session is over.

When eCinema is active, the meeting continues to run, but the main stage changes from participant video tiles to the shared video content.

---

## User Flow

### 1. Normal Meeting View

Before eCinema starts, participants see the regular Konn3ct meeting interface. The meeting can include video tiles, participant controls, microphone controls, camera controls, screen sharing, reactions, captions, chat, and other meeting tools.

The host can access the eCinema option from the meeting control bar.

---

### 2. Add Video Link

When the host selects the eCinema option, a modal appears asking the host to **Add link**.

The host can paste a YouTube link or other supported video link into the input field.

Example:

```text
https://www.youtube.com/watch?v=E-9T6V6A5ko
```

---

# Shared Recordings View

When a recording link is generated from the dashboard and shared with users (either authenticated or non-authenticated), the recording can be viewed by anyone with the link based on the access settings configured by the host. 

## Access Settings
The host can configure the recording to be accessible by:
1. Specific users (via provided email addresses)
2. Anyone with the link
3. Only participants of that specific meeting

## Architecture Approach

The shared recording viewer page is **bundled with the existing frontend Next.js directory**. 

### Why Bundling is Used:
- **Shared Components**: The recording viewer reuses many UI components, design tokens, and branding from the main application.
- **Authentication State**: For recordings restricted to specific logged-in users, sharing the same Next.js instance allows the reuse of existing authentication and session management logic.
- **Lower Overhead**: Maintaining a single Next.js instance simplifies CI/CD pipelines, avoids duplicate dependencies, and minimizes hosting costs.
- **Implementation Details**: Implemented by creating a dynamic public route in the current Next.js app, such as `/recordings/[recordingId]`, which handles its own permission checks before rendering the video.
