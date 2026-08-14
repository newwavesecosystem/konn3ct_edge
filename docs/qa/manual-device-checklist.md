# Manual Device Checklist

Execute these checks before major releases to ensure compatibility and stability across a realistic matrix of devices and viewports.

## Core Matrix
- [ ] Windows Chrome (High-end desktop)
- [ ] Windows Edge (Standard laptop)
- [ ] Android Chrome (High-end phone)
- [ ] Android Chrome (Low-end phone, test degradation)
- [ ] iPhone Safari (Test H.264 handling and preflight bypassing)
- [ ] Mac Safari / Chrome
- [ ] Tablet (iPad / Android Tab)

## Features to Verify Manually on Each Device
1. **Join Speed**: Observe TTFB and rendering time of the pre-join lobby.
2. **Reconnect Resilience**: Disconnect Wi-Fi for 5 seconds, reconnect, and verify media re-establishes without frozen frames.
3. **Mic Stability**: Check for echoing, auto-gain, and ensure mute/unmute propagates instantly.
4. **Camera Stability**: Check orientation on mobile. Ensure rotating the device updates layout gracefully.
5. **Active Speaker**: Verify the main stage successfully swaps to the current speaker without tearing.
6. **Spotlight Mode**: Verify host can pin a participant and it overrides active speaker for all viewers.
7. **Screen Share**: Verify readable text resolution on shared screens, particularly when viewed on mobile.
8. **eCinema**: Verify audio/video sync. Test scrubbing the video (if host) and checking late-joiners.
9. **Recording**: Start/stop recording. Verify the UI updates state (`Starting` -> `Recording` -> `Stopping` -> `Processing` -> `Completed`).
10. **Virtual Background**: Enable VB. Test CPU load. Ensure changing VB to `None` cleanly detaches the ML pipeline.
11. **Paystack Test Flow**: Attempt joining a paid room and process a mock payment. Verify instant admission post-payment.
12. **Layout Controls**: Verify bottom control bar groups logically on mobile. Ensure side panels (Chat, Participants) do not squish the main video on narrow screens.
