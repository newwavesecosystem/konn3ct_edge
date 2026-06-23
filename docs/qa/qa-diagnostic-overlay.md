# QA Diagnostic Overlay

The QA Diagnostic Overlay is an in-app tool designed strictly for development and testing. It surfaces technical state regarding WebRTC, media tracking, payment environments, and layout configurations so testers can easily append structured JSON context to bug reports.

## How to Enable It
In your root `.env` or `.env.local`, set:
```bash
NEXT_PUBLIC_QA_DIAGNOSTICS=true
```
Then start or restart the frontend server (`npm run dev`). 

A floating red bug icon (`🐞`) will appear in the bottom-right corner of the meeting room interface. Clicking it opens the diagnostic panel.

## How to Disable It
To turn off the overlay for normal production usage, change the variable to false or remove it:
```bash
NEXT_PUBLIC_QA_DIAGNOSTICS=false
```

## What Fields Mean

1. **Session**:
   - **User**: The truncated ID of the current participant, alongside their recognized role (e.g., host, participant, bot). Truncation ensures full IDs do not leak.
   - **Status**: The signaling lifecycle state (e.g., waiting, connected, ended).

2. **Device & Layout**:
   - **Mobile**: Determines if the browser believes it is rendering on a mobile OS.
   - **Viewport & Scroll**: Captures screen size vs document size. If `scrollWidth > viewportWidth`, a horizontal overflow is logged (helpful for mobile QA).
   - **Layout**: Current grid strategy (e.g., `gallery`, `speaker`, `spotlight`).

3. **WebRTC & Virtual Background**:
   - **Producers / Consumers**: Tracks raw mediasoup connection counts.
   - **Transport State**: The core send/recv WebSocket states.
   - **VB Mode & Degradation**: Highly critical for Android/iOS. Tracks if the background is `none`, `blur`, or `image`, and whether it auto-degraded (e.g., fallback due to performance issues).

4. **Recording & Billing**:
   - **Recording**: Indicates if a bot is actively deployed.
   - **Mock Billing**: Will show if `NEXT_PUBLIC_PAYSTACK_MOCK_MODE` is active.

## Reporting Issues & Marking Snapshots
When you encounter a bug (e.g., camera drops, audio echoes):
1. Open the QA Diagnostics Overlay.
2. In the yellow **Mark Issue Snapshot** section, optionally type a short note (e.g., "Camera just flipped to black").
3. Click **Mark Issue Now**. This captures the exact technical state of the app instantly.
4. You can continue testing and mark multiple snapshots.
5. Click **Download** to save all captured snapshots as a JSON file, or **Copy JSON**.
6. Paste or attach this JSON into the **Optional Diagnostic Data** section of your bug report template (`step6c-issue-report-template.md`).

## ⚠️ Security Warning
**What must never be shared publicly:**
- Actual payment keys, user passwords, or JWTs. (The QA Overlay deliberately strips out `botToken`, `JWT_SECRET`, or `PAYSTACK_SECRET_KEY` entirely, so they are not captured).
- If you copy the JSON while a private meeting link with query parameters is visible in your browser, ensure you do not share URLs containing embedded keys on public issue trackers.
- The overlay truncates User IDs, but avoid sharing the JSON dump in unauthenticated public forums.
