# Workspace Rules

### Audio Logic Integrity (CRITICAL)
- **Files:** `webrtc.ts`, `server.ts`, and `meeting-context.tsx`
- **Constraint:** NEVER modify the audio handling, autoplay unlocking, or microphone re-acquisition logic in these files.
- **Reasoning:** The audio architecture is perfectly stable and relies on delicate timing and browser-specific hacks.
- **Override:** Do not touch this logic unless the user explicitly tells you to AND you have asked for and received their approval TWICE.

### Testing Policy
- **Constraint:** Every new feature, change, or bug fix MUST be accompanied by revisiting the corresponding test or creating a new one if it does not exist.
- **Reasoning:** To ensure that the codebase maintains high test coverage and to prevent regressions, testing must be a mandatory part of every modification.

### Reaction UI and Logic Integrity (CRITICAL)
- **Files:** `ReactionsLayer.tsx` and `meeting-context.tsx` (reaction variables/functions)
- **Constraint:** NEVER modify the Emoji Reactions UI, animations, or underlying logic.
- **Reasoning:** The user has heavily customized the dynamic glassmorphic UI and organic float animations.
- **Override:** Do not touch this logic unless the user explicitly tells you to AND you have asked for and received their approval TWICE.
