### CollabCanvas MVP PRD (24h)

#### Document status
- Owner: Abdul + AI pair
- Version: Final v1.1
- Scope: First 24h MVP only (collaboration foundation). AI agent is out of scope for MVP and planned for next milestones.

---

### 1) Problem & Goal
- **Problem**: Teams need a fast, reliable way to co-create on a canvas with real‑time sync and presence. Existing tools are heavy; we need a focused MVP proving rock‑solid multiplayer foundations.
- **Goal (24h)**: Ship a deployed, public, multiplayer canvas that meets the collaboration checklist with strong performance and persistence.

---

### 2) Success Criteria (Acceptance Criteria)
Map directly to the assignment’s MVP checklist and performance targets.

- **Canvas basics**
  - Pan and zoom are smooth at 60 FPS on a modern laptop.
  - At least one shape type (rectangle) is supported.
  - Create and move objects with mouse/touch; operations feel immediate.

- **Real-time collaboration**
  - Two or more users in different browsers see updates in <100 ms for object changes and <50 ms for cursor position.
  - Multiplayer cursors display name labels.
  - Presence: online users shown with live join/leave updates.
  - Conflict handling: CRDT merges via Yjs (documented in README/PRD).
  - Cursor updates are throttled to 20 Hz with client-side interpolation for smoothness.

- **Persistence & resilience**
  - Canvas state persists if all users disconnect; on refresh, the last state is restored.
  - Reconnects recover session without data loss.
  - Offline-first client: edits buffered while offline; automatic resync on reconnect (Yjs merges; no errors surfaced to user).

- **Authentication & Access**
  - Users must authenticate (username/login via Clerk) to edit. Display name is required.
  - Anonymous view-only is available for the main canvas; editing triggers sign-in prompt.
  - Guest fallback allowed behind a feature flag if OAuth setup blocks progress; still requires a typed display name.

- **Deployment**
  - Public URL accessible without VPN.
  - Supports 5+ concurrent users without degradation for 500+ simple objects on canvas.
  - Post-login redirect to `/c/main` (single-canvas for MVP).

- **Quality bar**
  - Basic automated tests for Durable Object logic and snapshot debounce.
  - Short README with setup, deploy, and architecture overview.

---

### 3) Non‑Goals (MVP)
- Multiple shape types beyond rectangle, complex styling, grouping.
- Full history/versioning and multi-canvas dashboards.
- AI agent, function-calling, and complex layout commands.
- Fine-grained permissions/roles; export formats.

---

### 4) User Stories (MVP)
- As a user, I can sign in and see my display name.
- As a user, after login I am redirected to the single shared canvas (fixed ID) and see others’ live cursors and names.
- As a user, I can create a rectangle and drag it; others see it instantly.
- As a user, I can refresh or reconnect and the canvas resumes with prior state.
- As a user, I can invite another user via URL and collaborate within seconds.
 - As a user, if I go offline briefly, I can keep editing and my changes sync when I’m back.
 - As a visitor, I can open `/c/main` and view live changes without logging in.
 - As an unauthenticated visitor who tries to edit, I’m prompted to sign in.

---

### 5) UX Requirements
- Large canvas with trackpad/mouse pan and pinch/scroll zoom.
- Cursor labels show display name and distinct color per user.
- Minimal toolbar: Select tool, Rectangle tool, Hand tool; Undo/Redo optional (not required for MVP).
- Latency feedback: none needed if perceived instant; show subtle reconnect indicator when offline.

---

### 6) System Architecture (MVP)

- **Frontend**: React + Konva.js for performant canvas rendering and interactions.
  - Keep shape schema minimal; integrate with Yjs for shared state.

- **Realtime & Consistency**: Yjs CRDT for document/state sync.
  - Use Yjs Awareness for presence and cursor positions.

- **Transport & Coordination**: Cloudflare Durable Objects with y-durableobjects.
  - Single canvas for MVP: one well-known room id (e.g., "/c/main") routed consistently to one DO instance.
  - DO terminates WebSockets, handles Yjs sync/update + awareness, coordinates presence, and persists snapshots.

- **Persistence**
  - DO storage (strongly consistent, transactional) for Yjs snapshot and metadata.
  - Debounced persistence to avoid blocking WS loop (≥500ms idle or ≤2s window) and execute after broadcasts.

- **Authentication**
  - Clerk-hosted auth; Worker verifies JWT on WS upgrade using Clerk JWKS.
  - Anonymous view-only enforced by gating Yjs mutation handling.

- **Presence & Cursors**
  - Yjs Awareness messages for presence and cursors.
  - Client throttles cursor broadcasts to 20 Hz; DO rebroadcasts to room.
  - Backpressure: drop/merge stale awareness frames if outbound queue grows.

- **Conflict Resolution**
  - Shapes kept in Yjs shared document to handle concurrent edits.

---

### 7) Data Model (MVP)
- Room: { id, createdAt, lastActiveAt }
- User session (ephemeral in DO memory): { userId, displayName, color, lastSeenAt, ws }
- Yjs document (persisted in DO storage): shapes map keyed by id, minimal props for rectangle.
- Awareness (ephemeral): cursors and presence; not stored.

---

### 8) Wire Protocol (MVP)
- Yjs sync/update frames (binary) for document changes.
- Yjs Awareness updates (binary) for presence/cursors.
- No custom JSON protocol is required for MVP.

---

### 9) Performance Targets & SLOs
- 60 FPS during pan/zoom and object manipulation on a 2020+ laptop in Chrome.
- <50 ms p50 cursor propagation; <100 ms p50 object update propagation across two users (same region).
- Handle 500+ rectangles without frame drops; memory stable over 10 minutes of editing.

---

### 10) Security & Privacy
- Authenticated sessions required to join edit mode; anonymous view-only permitted for the main canvas.
- WS handshake validates JWT and injects user identity into the DO session.
- No PII beyond display name and OAuth subject identifier.

---

### 11) Observability
- Console logs with structured fields (roomId, userId, eventType) in Workers.
- Basic metrics counters (connections, broadcasts, room size) via logs; upgrade to a telemetry sink later.

---

### 12) Testing Strategy
- **Vitest-only**: Unit tests for snapshot/restore, debounce, and basic DO wiring (mocked storage/events).
- **Manual 2-browser check**: Create/move rectangle, verify real-time sync, presence, and persistence after refresh; test offline/resync by toggling network.
- **Perf smoke**: Scripted creation of 500 rectangles; manual pan/zoom check (DevTools FPS meter).

---

### 13) Deployment Plan
- Single Cloudflare Workers project with Durable Objects and static asset serving.
- Cloudflare Workers Git integration auto-builds and deploys on push to `main`.

---

### 14) Build Plan (24h)
1) Set up repo, Worker project with DO + y-durableobjects, wrangler config; scaffold React+Konva SPA served by Worker.
2) Implement single-room routing (fixed id) and WS endpoint; Awareness presence/cursors via Yjs.
3) Integrate Yjs provider (client) and persist Yjs doc in DO storage with debounced snapshots.
4) Rectangle create/move via Konva bound to Yjs shared state; cursor overlay with labels.
5) Auth: Clerk (guest fallback) with display names; token forwarded to WS and verified.
6) Offline/resync handling; Vitest tests; manual two-browser verification; deploy.

---

### 15) Risks & Mitigations
- Yjs snapshot latency: serializing large docs and writing to DO storage can add tens of ms and contend with the WS event loop if done per-update. Mitigate by batching (e.g., every 2s) or idle debounce (≥500ms) and persisting after broadcasts.
- y-durableobjects integration nuances → Keep schema minimal; stick to standard Yjs sync + awareness.
- Auth complexity → Clerk hosted UI; guest fallback behind feature flag if blocked (still tracks name).
- Latency across regions → Rely on Cloudflare’s edge; room affinity via DO routing.

---

### 16) References (essential)
- Cloudflare Durable Objects – [developers.cloudflare.com](https://developers.cloudflare.com/durable-objects/)
- Workers WebSockets – [developers.cloudflare.com](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- Yjs – [yjs.dev](https://yjs.dev)
- Konva – [konvajs.org](https://konvajs.org)
- y-durableobjects – [github.com/napolab/y-durableobjects](https://github.com/napolab/y-durableobjects)

---

### 17) Compatibility & Support
- Browsers: Latest Chrome, Edge, Safari, Firefox (desktop). Mobile Safari/Chrome supported but not optimized.
- Network: Works across Wi‑Fi and LTE; handles brief offline periods with resync.
- Accessibility: Keyboard pan/zoom not required for MVP; pointer events required.

---

### 18) Rate Limits & Backpressure
- Per-client message caps: max 30 msgs/s overall; cursors throttled to 20 Hz; transforms coalesced.
- Room limits: MVP target 5–15 concurrent editors; soft cap enforced via DO metrics.
- Backpressure policy: if outbound queue > threshold, drop oldest awareness frames first; for shape updates, send last-known state.

---

### 19) Submission Checklist (MVP)
- Public deployment URL.
- GitHub repo with README (setup, architecture, deploy), PRD, and CI workflow.
- Demo video (3–5 minutes): real-time collab, presence, reconnection/persistence, performance.
- AI Development Log placeholder created (content to be completed in later phase).


