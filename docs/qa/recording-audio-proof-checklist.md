# Recording Audio Proof Checklist

Because the Puppeteer bot captures the web meeting exactly as it renders, it is critical to perform manual audio proofing to ensure system audio loops and `MediaStreamTrack` injections are captured without echoes or silent drops.

## Test Script
- [ ] 1. Start a meeting as the **Host** on a Desktop computer (Chrome/Edge).
- [ ] 2. Join the same meeting as a **Participant** from another device (e.g., a phone or a separate computer to avoid audio feedback).
- [ ] 3. Start the recording via the Host interface.
- [ ] 4. Host speaks: "Host audio test, one, two, three." (Wait a moment).
- [ ] 5. Participant speaks: "Participant audio test, one, two, three." (Wait a moment).
- [ ] 6. Start a **Screen Share** from the Host device and keep it visible for at least 10 seconds.
- [ ] 7. Start an **eCinema** playback (if applicable to MVP) and keep it visible for at least 10 seconds.
- [ ] 8. Stop the recording.
- [ ] 9. Wait for the recording to finalize and process on the backend.
- [ ] 10. Play back the `.mp4` file securely from the dashboard via the new signed URL player.

## Verification Checklist
- [ ] **Host Audio:** Confirm the Host's voice is clearly present in the `.mp4` track without stuttering.
- [ ] **Participant Audio:** Confirm the Participant's voice is clearly present.
- [ ] **Screen Share:** Confirm the screen share appears visually in the recorded layout.
- [ ] **eCinema:** Confirm eCinema appears visually in the recorded layout, OR document if MVP policy explicitly excludes eCinema recordings.
- [ ] **Bot Stealth:** Confirm the recording bot did not beep, did not appear as an active speaker, and did not visually disturb the layout.
