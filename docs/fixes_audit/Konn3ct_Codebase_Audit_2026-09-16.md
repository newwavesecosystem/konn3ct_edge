**Konn3ct meeting reliability audit — 16 September 2026**

Prepared for Newwaves Ecosystem Ltd. Repository: [sirkays/konn3ct-test](https://github.com/sirkays/konn3ct-test). Purpose: investigate disappearing self-presence, selective loss of participant audio, and loss of identity/host authority during recovery. No product source was changed, committed, pushed, or deployed.

**The repository contains definite defects capable of producing these symptoms. Server overload is not required to explain the disappearing self-card. Audio and host recovery have several interacting faults; production incident attribution still requires the deployed revision and incident evidence.**

The primary review covers `konn3ct_meeting` at commit `67780bdf0f3e4ad206ad0bc32183cee6fac168d4`, dated 13 September 2026, commit message “404 join error.” The repository default is a different, older snapshot. Do not apply line-specific findings to production until the deployed code has been matched.

| Repository reference | Observed revision | Audit treatment |
|---|---|---|
| `konn3ct_meeting` | `67780bdf0f3e4ad206ad0bc32183cee6fac168d4` | Primary, detailed web/backend audit |
| Default `gov1_mobile` | `1b3cc411a89963973e3f4489256ec7e840555328`, 7 August 2026 | Compared key meeting, media, auth and deployment paths |
| `konnect_mobile` | Same `1b3cc411…` revision | Same snapshot as default at inspection |
| Production and Antigravity working copy | Not supplied/accessible here | Must be fingerprinted before fixes |

There are 284 changed files between the two inspected snapshots. In particular, the newer meeting branch has distributed session-resumption code, network-adaptation code and tests that the default snapshot lacks. The exact local-self-removal predicate below is present in the newer meeting branch and absent from the older default branch. This is a comparison of snapshots, not an established commit ancestry.

The supplied Windows working directory is `C:\Users\atteh\OneDrive\Desktop\workspace\konnect_project\konn3ct_edge_web\konn3ct_edge`. This audit used a separate read-only checkout of GitHub, not that Windows directory.

**What the evidence establishes.** The review traced the meeting frontend, participant selectors, WebRTC client, signaling server, media controllers/SFU, join and prejoin APIs, session/admission helpers, recorder lifecycle, Kubernetes manifests, deployment workflows, and relevant tests. Sixteen isolated forensic checks executed source-extracted callbacks or the actual transpiled WebRTC class with mocked framework/browser/network boundaries. All sixteen reproduced the behavior reported in the evidence bundle. Sixteen selected existing repository tests also passed. Neither result is a live meeting certification: no production logs, real browser audio, packet capture, deployed configuration, or two-hour-plus live recording test was available.

| User-reported incident | Strongest code explanation | Confidence and limits |
|---|---|---|
| Local participant disappears from cards and list; other people still see them | A remote `user_left` event deletes the local participant from local React state (A01). Duplicate remote identities can also corrupt local identity (A02). | A01/A02 reproduced against the actual callbacks. Production applicability depends on revision and event sequence. |
| A listener hears some speakers but loses one, often after weak connectivity or during recording | A failed consumer subscription/resume has no targeted repair; subscriptions can duplicate; microphone closure leaves stale tracks; one blocked audio element is hidden by another playing element (A03–A07). | Defects reproduced independently. Which occurred in a reported meeting requires per-speaker receiver evidence. |
| Host repeatedly reloads, reaches join details again, then is no longer host | Expired or wrong-room stored credentials block reload; the normal join service is external; dynamically assigned roles are not persisted to the admission record; resume and socket lifecycle are inconsistent (A06, A08, A09, A11). | Concrete implementation gaps. A two-hour expiry exists for local prejoin, but is not proven to be the expiry of the current normal join service. |

**Priority:** A01 and A10 require immediate attention: A01 is a direct presence defect; A10 is a host-authorisation defect discovered while reviewing recovery. Repair A03–A06, A08–A09 and A11 next as a coordinated, tested recovery change. A02 and A07 belong in the same regression scope. Infrastructure changes should follow deployed evidence, rather than blanket increases in resources or timeouts.

**A01 · Critical reliability defect: leaving participants also remove the local participant.**

Evidence: [meeting-context.tsx, onUserLeft](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/meeting-context.tsx#L2351-L2381). The callback ignores a leave event explicitly naming self, but its final filter uses:

```ts
prev.filter(p => !isLocalIdentifier(p.id) && !isLocalIdentifier(p.userId) && p.id !== userId && p.userId !== userId)
```

For every local entry, the first or second condition is false. Therefore any non-self leave event removes both the departed participant and self. The callback does not stop the local producer, so other participants can continue seeing the person while that person's own UI loses them. Cards and the participant panel share this participant state.

Forensic checks T01 and T02 reproduced removal for a human departure and a recorder-bot departure. A later authoritative participant snapshot may restore self, so disappearance can be transient, repeated, or prolonged if reconciliation is delayed. This qualification matters: the server normally schedules a participant snapshot approximately one second after relevant events.

Fix direction: remove only the departing remote session; preserve self by stable session identity. Keep explicit leave/kick/end behavior separate. Do not mask the fault only by adding a fallback tile. Test human departure, hidden bot departure, duplicate leave events, stale leave events and recovery snapshots.

Recording connection: a recorder is a participant. If it exits/restarts and generates a leave event, this predicate can affect every remaining client's local entry. Recording being active alone does not prove that the recorder departed. Meeting duration is not a condition in this faulty filter.

**A02 · High: duplicate remote identities can overwrite self's identity and role.**

Evidence: [meeting-context.tsx, roster reconciliation](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/meeting-context.tsx#L2104-L2273). `seenUserIds` and `seenParticipantIds` start with local identity, but are then populated with remote entries. The code subsequently uses these growing sets to decide whether a later entry is local. A duplicate remote entry is therefore treated as self; it mutates `localUser.id`, `userId` and `role` in place.

T03 supplied two remote entries with the same remote user ID. The original local host object became the remote participant's ID, remote user ID and attendee role. A normal, unique roster does not trigger this case. Reconnect duplicates or multi-device identities are the relevant conditions to establish in runtime evidence. The server's active-roster builder does not perform this identity deduplication before sending the array.

Fix direction: separate immutable local-identity matching from remote deduplication; do not mutate previous React-state objects. Define whether multiple devices under one user are allowed, and distinguish user identity from participant/session identity. Use immutable, versioned reconciliation with a tested local-presence invariant while the local session is active.

**A03 · High: a single failed audio subscription or resume can remain unrepaired.**

Evidence: [webrtc.ts, consumeRemoteStream](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/webrtc.ts#L2700-L2785), [server consume error handling](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/signaling/server.ts#L4131-L4146), and [SFU paused-consumer creation/resume](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/media/sfu.ts#L438-L508).

The SFU correctly creates a consumer paused. The client attaches its track to participant state before the server resume succeeds. A resume rejection only writes a console error; consume failure is also caught without being propagated. Some server consume exceptions send no correlated failure response, leaving the client to wait ten seconds. There is no retry scheduled by these failed paths. A later whole-session recovery may repair them, but ordinary ongoing participation does not guarantee that repair.

T07 and T08 reproduced one attempted request, no repair timer, and no propagated failure; T07 left a registered track despite failed resume. This can affect one speaker's subscription while other subscriptions continue playing.

Fix direction: introduce a bounded per-producer recovery lifecycle, reject correlated errors promptly, verify remote resume, and reconcile failed audio subscriptions without resetting healthy ones. A missing producer should trigger authoritative producer discovery; a transient timeout can be retried with bounded backoff. Never unmute a user or reacquire every microphone as a blanket repair.

The paused-first sequence should be preserved; it is the recommended [mediasoup consume sequence](https://mediasoup.org/documentation/v3/communication-between-client-and-server/). The fault is incomplete application recovery around it.

**A04 · High: consumer indexing and cleanup permit duplicates and stale audio tracks.**

Evidence: [healthy-session reconciliation](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/webrtc.ts#L571-L587), [consumer registration](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/webrtc.ts#L2700-L2748), and [onConsumerClosed](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/meeting-context.tsx#L1914-L1945).

`consumers` is keyed by consumer ID, but reconnection checks `consumers.has(p.producerId)`. Existing subscriptions therefore look absent. `consumeRemoteStream` has no existing-subscription or in-flight deduplication guard. T05 triggered an extra consume for an already subscribed producer; T06 created two consumers for the same producer.

The microphone branch stores only `audioTrack`, while closure cleanup handles camera and screen metadata, with no corresponding microphone producer/consumer identity cleanup. T04 retained an ended microphone track. Explicit consumer closure also does not uniformly unregister its metadata, leaving further state to reconcile.

Fix direction: maintain a producer-to-consumer index, one in-flight subscription per producer per receive-transport generation, and complete source-specific identity/track cleanup. Replace an old microphone track only when the event refers to its exact producer/consumer generation; a stale close must never erase a replacement track. Verify counters return to baseline after repeated reconnects and producer replacement.

**A05 · High: request acknowledgements can be matched to the wrong consumer, and success may be overstated.**

Evidence: [client response dispatch](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/webrtc.ts#L422-L449), [server resume/pause acknowledgements](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/signaling/server.ts#L4242-L4260), and SFU resume lines 484–508 cited above.

The client supports request IDs but falls back to a FIFO queue when they are absent. The server omits request IDs from `resumed` and `consumer_paused`. Concurrent asynchronous operations can complete out of order. T09 delivered B's acknowledgement before A's and resolved A's promise with B's consumer ID. In addition, SFU resume can return normally for a missing/closed producer or consumer; signaling then emits `resumed` anyway. A signaling acknowledgement is not proof that audio packets are arriving or being played.

Fix direction: consistently echo and validate request ID, consumer ID and session/transport generation; return explicit success or failure. Make retries idempotent. Preserve compatibility during frontend/backend rollout rather than switching a protocol unilaterally.

**A06 · High: signaling resume and media resume disagree about whether transports survive.**

Evidence: [server reconnect cleanup](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/signaling/server.ts#L1689-L1759), [cleanupParticipantMedia](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/signaling/server.ts#L333-L354), and the client healthy-session reconciliation linked in A04.

On a reconnect during the presence grace period, the server creates a new client and closes the prior client's transports/producers. It does not transfer transport ownership into the new client. The frontend, meanwhile, decides whether to preserve transports using its local connection-state values, which can temporarily still be `connected`, `connecting` or `new`. That permits preservation of a transport whose server counterpart was destroyed. Recovery may eventually happen when ICE fails, but the two sides have no explicit shared media-generation contract. The reset path also closes transports without awaiting all asynchronous media-controller cleanup before fresh media requests can proceed.

The connection callback performs asynchronous admission/Redis/media work before installing its WebSocket message listener, while the client sends `resume_session` immediately on open. That is a source-level ordering race worth reproducing with delayed Redis/media operations; it was not live-tested here.

Fix direction: explicitly distinguish signaling-only reconnection, page reload, expired media, and media-pod failure. Resume healthy media only if the server proves the corresponding objects and ownership are still valid; otherwise negotiate an acknowledged replacement generation and rebuild it once. Install/queue incoming-message handling before asynchronous initialisation. Preserve mic intent and camera-off state through either branch.

**A07 · High for affected listeners: playback failures are tracked globally instead of per required track.**

Evidence: [AudioRenderer](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/meeting-context.tsx#L3585-L3624). A rejected `play()` checks whether any other audio element is playing. If one is, the global playback error is cleared even though this element is still blocked. Every successful element also clears the same flag. T14 reproduced a blocked element with `globalPlaybackError: false`.

Fix direction: track playback readiness by active audio track/slot and aggregate unresolved required-track failures. Retain the established reusable audio elements and user-gesture unlock mechanism, with a visible recovery action when required. Do not infer that all speakers are audible from one successful `play()` call. Browser rejection of playback is documented in [HTMLMediaElement.play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).

Secondary capacity risk: `GlobalAudioRenderer` defaults to eight slots. Once full, a participant without `isSpeaking` receives no slot; selection depends on active-speaker events. Validate more than eight receivers, delayed/lost speaker indicators and configured `NEXT_PUBLIC_MAX_AUDIO_SLOTS`. The cap is not proof of the reported issue when fewer tracks were active, and should not simply be removed without capacity testing.

**A08 · High: reload credentials, room identity and join-service behavior are inconsistent.**

Evidence: [local prejoin](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/app/api/prejoin/route.ts#L32-L64), [join token validation](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/app/api/join/route.ts#L70-L119), [normal join flow](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/app/join/%5BroomSlug%5D/page.tsx#L338-L430), and [kv4 proxy](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/app/api/kv4/%5B...path%5D/route.ts).

| Credential/state | Implemented lifetime or behavior | Consequence |
|---|---|---|
| Local `/api/prejoin` token | 2 hours | A subsequent `/api/join` rejects it after expiry; reproduced in T12. |
| `/api/join` connection token | 24 hours | An existing socket does not automatically fail at the two-hour prejoin boundary. |
| Tokens in repository `src/routes/external.ts` | 6 hours | These APIs cannot be assumed to be the separate kv4 service. |
| Normal current join UI | `/api/kv4/join-room`; local prejoin only for `playwright-*` rooms | Actual upstream token issuance, identity rules and expiry are outside this repository. |
| Browser join-token lookup | Global `sessionStorage` token preferred over room-specific `localStorage` token | A token for another room can mask the correct room token and fail validation. |
| Resume token/meeting generation | WebRTCClient instance fields | They do not themselves survive a hard page reload. |

The meeting provider maps every `/api/join` 403 to “invalid or expired session,” although the same endpoint also returns 403 for PIN and guest-policy failures. The provider's join request does not forward a PIN. The PIN-protected flow therefore needs an admission grant or an explicit validated handoff; do not solve it by skipping checks. The endpoint also validates a supplied expired session token even after a successful dashboard-cookie authentication, so a stale token can defeat an otherwise valid account session.

The normal join UI decodes a stored host token without validating its room or expiry, sets `hasExistingHostSession`, and then reuses that token in `handleJoin`. An expired stored host token can loop back into the same failure. If the external join response reports success but supplies no `sessionToken`, the code still navigates to the meeting, where missing credentials can send the user back to the lobby.

Fix direction: separate account authentication, room admission, signaling credentials and reconnect credentials. Store room-scoped references and preserve stable identity through server-validated renewal. Use error codes that distinguish expired authentication, revoked admission, room mismatch, PIN failure and temporary upstream outage. Do not make expired credentials valid indefinitely or trust localStorage role claims. Capture only token metadata such as issuer, audience and lifetime when diagnosing; never log bearer tokens.

**A09 · High: delegated host/co-host authority is not updated in durable admission state.**

Evidence: [processAdminCommand/change_role](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/signaling/server.ts#L642-L657), [role restoration](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/signaling/server.ts#L1461-L1493), and admission recovery at lines 1567–1574.

Role changes update the live client, participant snapshot and broadcast, but not the admission record that later recovery consults. T13 reproduced a live promotion and snapshot write with zero admission writes. If a delegated host's transient participant record disappears, the durable record can still say attendee. Conversely, a previously stored host admission can override a later demotion. New guest identities issued by rejoin further break the connection to the old admission.

Fix direction: persist authorised role changes/revocations with role version and meeting identity, then publish them. Restore authority from authenticated ownership or a valid delegated role grant. Define behavior for same-user multiple devices, host transfer and re-entry after the grace window. Reconnection is not permission to resurrect revoked roles.

**A10 · Critical security defect: host recovery trusts unverified identity fields and signaling lacks room binding.**

The local prejoin endpoint signs a guest-supplied email without proving ownership of that email. The signaling upgrade promotes the user if that email matches the room owner's email. T15 executed the actual local prejoin handler and source-extracted upgrade handler with synthetic data: the guest attendee became host despite not being the authenticated owner. The upgrade also recovers privileges using a caller-supplied participant ID before proving that it belongs to that identity.

The same upgrade verifies the JWT signature but does not require the token's room to match the requested room, or require a signaling-token purpose. T16 accepted a synthetically signed local session for room A at room B. The frontend `/api/join` check does not protect a direct WebSocket upgrade. These were isolated checks, not requests against live users or production rooms.

Evidence: [prejoin input/signing](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/app/api/prejoin/route.ts#L11-L64) and [signaling upgrade](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/signaling/server.ts#L1407-L1538).

Fix direction: require server-verified identity and explicit room-scoped admission/role grants. Verify intended token type, issuer/audience where applicable, room and current meeting instance, participant ownership, revocation and generation before granting or recovering authority. Resolve trusted external identities through a documented verification boundary. Preserve legitimate external integrations by coordinating the contract; do not retain guest email matching as a compatibility shortcut.

**A11 · High: stale socket timers and incomplete lifecycle handling amplify poor-network recovery failures.**

Evidence: [socket open/heartbeat](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/webrtc.ts#L359-L410), [reconnect scheduling](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/webrtc.ts#L836-L875), and [disconnect](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/frontend/lib/webrtc.ts#L2830-L2861).

T10 showed that old `lastPongAt`/`lastPingAt` values can cause a newly opened socket's first heartbeat tick to close it before sending a new ping. This applies when no new pong has reset those values. T11 showed that an already scheduled reconnect still opens a socket after `disconnect()` because that timer is not cancelled. Multiple attempts and delayed old callbacks are not fenced consistently by socket generation.

`connect()`/`manualReconnect()` resolve after constructing a WebSocket, rather than after session/media recovery, so the UI's awaited retry does not prove a usable meeting. `disconnected` ICE states wait for browser auto-recovery; explicit intervention starts at `failed`, without a dedicated bounded-disconnection watchdog in those handlers. Generic failure handling then disconnects the client and its media.

Fix direction: one connection supervisor; one in-flight attempt; per-socket heartbeat baselines; immutable socket references; generation checks after async boundaries; cancellation of retries, queues, media operations and callbacks on disposal. Define bounded recovery escalation without destroying healthy tracks unnecessarily or reporting connected before usable state is established.

**A12 · Server/setup risks: configuration weaknesses are visible, but production failures are unproven.**

| Area | Repository evidence | Runtime evidence needed |
|---|---|---|
| Deployed revision | Deployment workflow triggers `main`, `prod`, `1gov_stag`; none is among the three advertised branches in this repository snapshot. | Image digest/source SHA for frontend, signaling, media and recorder; actual deployment repository and workflow. The visible workflow alone cannot prove what is running. |
| Redis state retention | [Base Redis manifest](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/k8s/base/redis.yaml) has one replica, `allkeys-lru`, no persistent volume, 1 GB configured maxmemory and 1 GiB container limit. Test overlay lowers memory to 512 MiB without changing maxmemory. | Applied manifest; Redis evictions, RSS, restarts/OOM, persistence and latency during incident; whether a managed Redis replaces this manifest. |
| Media routing under delay | RedisMediaController checks a 10-second media heartbeat and routes RPC via Redis Pub/Sub with a five-second timeout. Missing heartbeat can reassign a room to another pod. | Event-loop delay, Redis latency/disconnects, heartbeat gaps, old/new pod and router IDs, stale transport errors and actual failover outcome. |
| Worker sizing | `config.mediasoup.numWorkers` uses `os.cpus().length`; media pod CPU is constrained by manifests. | Actual cgroup CPU limit, worker count and per-worker utilisation. Host core count need not equal available pod CPU. |
| Recorder workload | Headful Chromium at 1920×1080 with software graphics plus capture/transcode workers. Production overlay explicitly requires recorder separation from media/signaling nodes. | Verify that overlay is applied; node placement, browser/transcode concurrency, CPU throttling, memory/GC, disk/network and recorder restarts. Separation is already evidenced in the production overlay and must not be described as absent. |
| Scaling | Production HPA specifies media min 3/max 10, even though the deployment patch says one replica. Individual room routing still chooses a particular media pod. | Effective replicas, room placement and tested active-room recovery. More replicas alone do not prove continuity of existing transports. |
| TURN/restrictive networks | Signaling supplies `turn:…:443` and `turn:…:3478`, with no explicit TCP/TLS alternatives in that list. | Relay-only connection tests; coturn listeners/certificates/firewalls; credential validity and selected candidate pairs on affected networks. A port numbered 443 alone does not establish TURN TLS support; see [RFC 7065](https://www.rfc-editor.org/info/rfc7065/). |
| Proxy timeouts | Base ingress read/send timeout is 3600 seconds; application pings run every 12 seconds. | Actual ingress/LB settings, close codes, traffic gaps and upstream resets. A one-hour configured timeout is not proof of a fixed one- or two-hour disconnect. |

Redis is used for admission, session leases, roster, producer discovery and recorder coordination. Eviction is therefore a correctness risk, not merely a cache miss. [Redis documents that `allkeys-lru` evicts keys under memory pressure](https://redis.io/docs/latest/develop/reference/eviction/). Separate disposable cache data from authoritative session state, provide suitable durability/recovery and memory headroom, and test failure behavior before rollout. Do not blindly change to `noeviction`: write errors also require handling.

The lease-acquisition Lua script receives `expectedAdmissionGen` but does not compare it with the admission generation. Resume-token verification and admission mutation are separate operations. These are additional concurrency/revocation gaps requiring targeted stale-admission tests before treating the existing generation mechanism as complete.

Recording can expose the verified defects through extra consumers, recorder churn, or resource/RPC pressure. The repository does not establish that CPU exhaustion caused the reported events. Existing camera adaptation primarily targets video; removing poor-network adaptation is not an evidence-based fix for selective missing audio.

**A13 · High assurance gap: passing current tests does not establish recovery correctness.**

Executed command: the repository's locked Vitest binary against `test/unit/host-recovery.test.ts`, `consumer-mapping.test.ts` and `network-resilience-controller.test.ts`, using dummy test-only environment values. Result: 3 files, 16 tests passed.

The host-recovery tests reimplement role-resolution snippets rather than calling the actual HTTP/WebSocket boundary. One positively asserts owner-email matching, thereby blessing the A10 weakness. Consumer-mapping tests likewise simulate selected camera/screen logic. The root Vitest configuration excludes several media/UI suites, including `webrtc.test.ts`, mute-latency and action-lifecycle tests. Its include paths omit frontend-local unit tests. The quality workflow's step labelled “Unit & Integration Tests (with Typechecking)” actually runs `npm run test:unit`; that label does not execute integration tests or a typecheck. Browser tests exist, but local `playwright-*` join routing bypasses the normal external join service.

Fix direction: use actual reducers/callbacks, production API handlers and protocol boundaries in regressions. Exercise the real join contract as well as synthetic rooms. Check what each CI command executes and connect deployment to required passing checks. Report skipped, excluded and blocked suites explicitly. No full build, full suite, native SFU test, browser matrix or soak certification is claimed by this audit.

**A14 · Adjacent security/diagnostics defect: credentials are written to logs.**

[src/routes/external.ts, lines 24–35](https://github.com/sirkays/konn3ct-test/blob/67780bdf0f3e4ad206ad0bc32183cee6fac168d4/src/routes/external.ts#L24-L35) logs both the submitted API key and the configured API key. Some browser tests also print resume tokens. Remove this logging and review access/retention of affected logs; rotate exposed credentials through the normal secret-management process if exposure is confirmed. Do not include secrets in the audit evidence supplied back to ChatGPT or Antigravity.

**Verification evidence supplied with this report.**

| Check | Isolated observed result |
|---|---|
| T01 | Human departure removed self and the departed peer. |
| T02 | Recorder departure removed self. |
| T03 | Duplicate remote user changed the local host object to remote identity/attendee. |
| T04 | Microphone producer closure retained an ended audio track. |
| T05 | Healthy reconnection attempted to consume an already subscribed producer. |
| T06 | Two simultaneous requests created two consumers for one producer. |
| T07 | Failed resume left a published track, one attempt and no retry. |
| T08 | Failed consume returned without propagating an error or scheduling repair. |
| T09 | Reversed acknowledgement order resolved the wrong consumer promises. |
| T10 | An old pong timestamp closed a new socket before its first new ping. |
| T11 | Scheduled reconnect opened a new socket after intentional disconnect. |
| T12 | Local prejoin expired after two hours while the connection token remained valid. |
| T13 | Delegated role promotion wrote the participant snapshot but not admission. |
| T14 | Another playing audio element hid the blocked element's playback error. |
| T15 | Guest-supplied owner email resulted in host authority at the upgrade boundary. |
| T16 | Upgrade accepted a token issued for a different room. |

The evidence archive contains `reproduce.cjs`, `results.json`, `existing-tests.log` and a usage README. It executes unchanged production source at isolated boundaries, not a real browser or a live server. A “DEFECT_REPRODUCED” result means the check confirmed the defect; it is not a passing product acceptance test. Source hashes identify the files used. No native media workers or production services are required by that harness.

**Required server evidence to finish incident attribution.** For one affected meeting, collect a common UTC timeline, meeting instance and pseudonymised participant/session IDs. Record the deployed revision for every service and which join path supplied the session. Collect affected-speaker outbound RTP, affected-listener inbound RTP and consumer IDs, track state, playback promise result, audio-slot assignment, ICE/DTLS state and selected candidate pair. Include receiver evidence from one listener who could hear the speaker for comparison.

At the same timestamps collect signaling close codes/reasons, reconnect/admission/role events and generations; SFU transport/producer/consumer closure and resume outcomes; RPC timeouts; recorder start/stop/restart generation; Redis latency/eviction/restart metrics; media and recorder resource usage and pod events. Record external join HTTP result/error code and token lifetime metadata without retaining tokens. This distinguishes “speaker not sending,” “SFU not forwarding,” “listener not subscribed,” and “browser refusing playback.”

**Acceptance before production promotion.** Verify three independent participants, with a distinct identifiable audio source per speaker, through signaling-only loss, actual media impairment and hard reload. Test 5-, 20-, 30-, 60- and 120-second outages to cross the implemented 25-second presence and 60-second resume boundaries. Apply impaired networking to only one participant in each direction; HTTP throttling alone does not simulate WebRTC UDP loss. Test recorder start/stop/restart while peers join/leave, and more than eight audio participants. Verify self remains exactly once, no duplicate live consumers, preserved mic/camera intent, authorised host/co-host persistence and revocation, and isolation between meetings.

Run accelerated token-expiry tests and an actual continuous recording soak beyond the observed two-hour boundary; four hours is a proposed diagnostic duration, not a claim about the product's approved meeting limit. Cross the six-hour external-token boundary with an accelerated expiry test if that path is used. Include the actual supported desktop and mobile browser/device matrix, explicit playback-gesture cases, Wi-Fi/mobile handover, stale messages, delayed ACKs, media-pod restart and Redis interruption in staging. Require measured audio recovery and stable resource counts, not just a visible “connected” label. Produce a staged rollout and rollback plan with the exact verified image revisions.

The accompanying Antigravity prompt turns these findings into a bounded implementation sequence. It requires confirmation against the Windows working copy, source-level regression tests, minimal repairs, truthful validation results and a server-evidence request for anything that cannot be established locally.
