Konn3ct Incident 4 evidence — 16 September 2026

Audited revision: 67780bdf0f3e4ad206ad0bc32183cee6fac168d4.

Contents:
- reproduce-incident4.cjs: unchanged source callbacks, current-user selector and audio renderers extracted with the TypeScript AST; actual transpiled WebRTCClient for the protocol check.
- results.json: five isolated observations, zero harness failures.

E00 is a normal-self exclusion control. E01 reproduces local capture being routed to unmuted playback after a duplicate remote roster entry. E02 demonstrates an unsafe rendered state before a reconciliation effect during an identity transition; it does not measure browser scheduling or audible duration. E03 demonstrates inconsistent screen/microphone self guards with synthetic state; it does not prove a normal screen-capture flow creates that state. P01 tests the generic resume-error response proposed in Antigravity's supplied plan against the current client.

Tracks, React hooks, playback, browser events, timers and network boundaries are mocked. There is no real acoustic output, production meeting, SFU, Redis, live server or long-duration recording in these checks. DEFECT_REPRODUCED means a defect was observed; it is not a passing product acceptance result.

With the audited repository's locked development dependencies already installed, run:

node reproduce-incident4.cjs <absolute-path-to-repository>

Example repository argument on Windows:
"C:\Users\atteh\OneDrive\Desktop\workspace\konnect_project\konn3ct_edge_web\konn3ct_edge"

Read the script first and compare the working revision. A fixed implementation may no longer reproduce the defect; do not reset local work to force these checks to reproduce. Turn these observations into enduring regressions expecting the correct behavior. The harness requires TypeScript and jsonwebtoken from the repository's installed node_modules; it does not install anything or alter product source.

Source hashes are recorded in results.json. No real operational credentials are included.
