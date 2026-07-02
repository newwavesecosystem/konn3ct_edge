# Workspace Rules

### Audio Logic Integrity (CRITICAL)
- **Files:** `webrtc.ts`, `server.ts`, and `meeting-context.tsx`
- **Constraint:** NEVER modify the audio handling, autoplay unlocking, or microphone re-acquisition logic in these files.
- **Reasoning:** The audio architecture is perfectly stable and relies on delicate timing and browser-specific hacks.
- **Override:** Do not touch this logic unless the user explicitly tells you to AND you have asked for and received their approval TWICE.
