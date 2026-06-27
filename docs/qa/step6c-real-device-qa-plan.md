# Step 6C: Real-Device QA Plan

The objective of Step 6C is to perform disciplined, repeatable, and evidence-based manual testing on real devices for Konn3ct. 

## Device Matrix

Ensure testing covers the following device combinations:

| Category | Device Name / Model | OS Version | Browser / Version | Network Type | Test Date | Tester Name | Pass/Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Windows Chrome** | | | | | | | | |
| **Windows Edge** | | | | | | | | |
| **Android Chrome (Standard)** | | | | | | | | |
| **Android Chrome (Low-end)** | | | | | | | | |
| **iPhone Safari** | | | | | | | | |
| **iPad/Tablet (Optional)** | | | | | | | | |
| **Mac Safari/Chrome (Optional)** | | | | | | | | |

## Core Meeting Test Script
For *each* device above, verify the following core functions:
- [ ] 1. Join meeting by link.
- [ ] 2. Time-to-join feels fast.
- [ ] 3. Refresh page and reconnect.
- [ ] 4. Leave and rejoin.
- [ ] 5. Mic permission works.
- [ ] 6. Mic mute/unmute works.
- [ ] 7. Speak-while-muted warning works.
- [ ] 8. Camera permission works.
- [ ] 9. Camera on/off works.
- [ ] 10. Remote users can see video.
- [ ] 11. Remote users can hear audio.
- [ ] 12. Active speaker indicator is stable.
- [ ] 13. Spotlight/pin is stable where applicable.
- [ ] 14. Participant names display correctly.
- [ ] 15. Participant list updates correctly.
- [ ] 16. Chat/participants panel does not break layout.
- [ ] 17. Screen share is visible and readable.
- [ ] 18. eCinema starts and late joiner syncs.
- [ ] 19. Reactions do not block controls.
- [ ] 20. Waiting room/admit behavior works.

## Mobile-Specific Test Script
For Android and iPhone devices specifically, verify:
- [ ] 1. Camera starts successfully.
- [ ] 2. Front/back camera switching works.
- [ ] 3. No black screen after camera switch.
- [ ] 4. Browser background/minimize then return works securely.
- [ ] 5. Refresh and reconnect successfully.
- [ ] 6. Lock/unlock phone if practical.
- [ ] 7. Mobile controls are reachable without horizontal scrolling.
- [ ] 8. Bottom controls are not hidden by browser toolbar.
- [ ] 9. Chat keyboard opening does not destroy layout.
- [ ] 10. Virtual background either works smoothly or gracefully disables.
- [ ] 11. iPhone Safari does not reintroduce tempStream camera lock.
- [ ] 12. Mobile/iOS does not reintroduce simulcast black video.

## Severity Rules & Acceptance Criteria
When logging issues using the Issue Report Template, apply these severity levels:
* **Critical**: Blocks meeting join, audio, video, payment, recording, or security.
* **High**: Serious instability, frequent reconnection failure, black camera, broken mobile layout.
* **Medium**: Feature works but with confusing UX or inconsistent behavior.
* **Low**: Cosmetic issue.

**Acceptance Rule for Step 6C:**
Step 6C is passed ONLY if Windows & Android Chrome, and iPhone Safari pass their respective test scripts. The recording audio proof and Paystack real test-key flows must also pass. No Critical issues can remain open, and no High issues can remain without an approved workaround.
