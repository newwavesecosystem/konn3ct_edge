# Regression Checklist

Execute these checks before major releases to ensure known fixed issues do not regress.

## Media & Stability
- [ ] **Black Camera Self-Healing**: Block the camera intentionally or trigger a frozen frame; the UI should gracefully restart the track.
- [ ] **iOS no tempStream preflight**: Ensure iOS Safari users bypass the temporary camera stream preflight step, as this crashes mobile Safari WebRTC connections.
- [ ] **No mobile/iOS simulcast black video**: Verify iOS Safari uses `maxBitrate` capping instead of full simulcast layers to prevent frozen black video on join.
- [ ] **VB `none` uses direct camera track**: Disabling Virtual Background entirely bypasses the canvas processing pipeline and uses the hardware track directly.
- [ ] **VB auto-degrades**: Heavy CPU load gracefully disables Virtual Background instead of crashing the tab.

## Features & UI
- [ ] **Participant names**: Participant names display correctly instead of reverting to random UUIDs.
- [ ] **Participant list updates**: The participant list natively syncs when a user joins late.
- [ ] **eCinema syncs on late join**: Late joiners automatically sync to the current eCinema video timestamp and play state.
- [ ] **Layout stability**: Mobile bottom controls group properly; Side panels (Chat, QA, Participants) don't overflow horizontally on desktop.

## Recording Bot Reliability
- [ ] **Recording bot no beep/toast**: Bot joining emits absolutely no audio beep and no "Joined the meeting" toast.
- [ ] **Recording bot excluded from active speaker**: The bot does not overtake the main stage, even if the host is silent.
- [ ] **Duplicate start/stop safe**: Mashing the "Start Recording" button does not spawn multiple bots, thanks to the Prisma transaction lock.

## Security & Payments
- [ ] **Paystack frontend redirect**: Completing a Paystack checkout redirect alone does not grant access; the backend webhook handles the DB transaction source of truth.
- [ ] **Paid recording access**: An active global subscription does *not* bypass a `recordingId`-specific paywall. Paid recordings require a specific transaction.

## 🛑 PRODUCTION BLOCKERS (Step 6)
> [!WARNING]
> **Public S3 URL for Recordings**: Currently, S3 uploads generate a permanent, public URL. 
> **Required fix before launch**: Implement signed S3 URLs or a token-gated proxy. The backend must authorize access before returning a playback URL to ensure private/paid recordings remain secure.
