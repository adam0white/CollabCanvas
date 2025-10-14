### CollabCanvas MVP — Pull Request Plan

Guidelines
- Each PR compiles independently and keeps main deployable.
- Minimal scope per PR; no unrelated changes.
- Use `npm init -y` to bootstrap; prefer small diffs.
- Tests: Vitest where applicable. Manual 2-browser checks listed.
- Dependencies are explicitly chosen to speed delivery and reduce tech debt.
- CI/CD: Cloudflare Workers Git integration builds and deploys on push to `main`.
- Single repo (no workspaces); Worker and web app live together.

Chosen dependencies (locked for MVP)
- Core: TypeScript, Vite, React, Konva, Yjs, y-protocols, Wrangler, Vitest, Biome
- Realtime server: Cloudflare Durable Objects with y-durableobjects (Yjs sync + Awareness)
- Auth: Clerk (frontend) + `@clerk/backend` (JWT verification)

---

PR 1 — Repo Bootstrap, Tooling
- Initialize repo and root package: `npm init -y`
- Add `.editorconfig`, `.gitignore` (node_modules, dist, .wrangler, .env*), `README.md`
- Add TypeScript + Vitest baseline
  - deps: `typescript`, `vitest`, `@types/node`
  - `tsconfig.json` (strict, ES2022, moduleResolution bundler)
  - `vitest.config.ts`
- Formatter/Lint: `biome`
- Acceptance: `npm run build` passes (tsc), `npm test` runs

PR 2 — Wrangler + Durable Object Skeleton
- Add `wrangler.toml` with DO binding `RoomDO` and static asset mount (for `web/dist`)
- Add `src/worker.ts` (fetch handler) and `src/room-do.ts` (DO stub)
- Routes (plain fetch):
  - `GET /health` → 200 OK
  - `GET /c/main` → serve SPA index.html
  - `GET /c/main/ws` → WebSocket upgrade and route to DO
- Scripts: `dev`, `build`, `deploy`
- Acceptance: dev server up; WS route upgrades

PR 3 — y-durableobjects + Presence (Awareness)
- Add deps: `yjs`, `y-protocols`, `y-durableobjects`
- In DO (`RoomDO`):
  - Initialize `Y.Doc` and y-durableobjects wiring for sync + awareness
  - Track connections; broadcast awareness (presence/cursors)
  - Debounce persistence: snapshot state on idle (≥500ms) or window (≤2s), persist after broadcasts
- Vitest: debounce util + storage snapshot/restore tests
- Acceptance: two WS clients sync Yjs state; presence visible

PR 4 — React + Vite + Konva SPA
- `npm create vite@latest web -- --template react-ts`
- Add `konva` and `react-konva`
- Minimal UI: stage + layer + simple toolbar (Select, Rectangle)
- Build to `web/dist`; worker serves `/c/main`
- Acceptance: canvas loads at `/c/main`

PR 5 — Auth: Clerk Frontend + Worker JWT Verification
- Web: integrate `@clerk/clerk-react`, post-login redirect to `/c/main`
- Pass JWT to WS (query/header)
- Worker: verify JWT with `@clerk/backend` (JWKS)
  - Valid → editable; missing/invalid → view-only
- Acceptance: unauthenticated view-only, authenticated can edit

PR 6 — Client Yjs Wiring (Awareness + Sync) ✅ COMPLETED
- Web: init `Y.Doc`; connect to `/c/main/ws` via `y-websocket` WebsocketProvider
- Hook Yjs Awareness for presence/cursors (50ms throttle client-side)
- Lifecycle documentation: token refresh triggers reconnect; provider cleanup on unmount
- Hardened WebSocket route parsing: rejects unexpected paths before DO routing
- Role enforcement: viewer clients cannot apply document updates at DO level
- Shared counter component demonstrates basic state round-trip (Y.Map syncs across clients)
- Acceptance: ✅ Presence syncs (3 people, cursors); counter increments propagate; quality gate passed

PR 7 — Shapes: Rectangle Create/Move via Yjs + Konva ✅ COMPLETED
- Define shape schema in Yjs (Y.Map keyed by shape ID for fast lookups)
- Konva bindings:
  - Click-and-drag rectangle creation with live preview (dashed outline)
  - Drag-to-move existing shapes when Select tool active
  - All shapes render from Yjs state via ShapeLayer component
- Toolbar integration: Select/Rectangle tools with shared state via context
- Auth enforcement: only authenticated users can create/move shapes; viewers read-only
- Architecture: modular hooks (useShapes, useToolbar), clean separation of concerns
- Acceptance: ✅ Code complete; shapes persist in Yjs; quality gate passed (build, lint, tests)

PR 8 — Offline/Resync, Performance, Security, Docs
- Offline/resync: verify Yjs buffers and merges on reconnect; add reconnect indicator
- Performance: confirm 60 FPS; enforce ≤30 msgs/s per client; coalesce transforms
- Security: enforce edit gating for Yjs mutations; sanitize display names; basic CSP headers
- README: setup, architecture, deploy, troubleshooting; public URL; demo script outline
- Acceptance: manual tests pass; deployment successful

PR 9 — Cleanup, Refactor, Extendability
- Cleanup: remove unused code, simplify imports
- Refactor: extract reusable utils (debounce, snapshot/restore)
- Check: React StrictMode in development should not occur in production
- Check: Some chunks are larger than 500 kB after minification
- Add tests
- Check CICD logs

Notes
- Awareness covers presence/cursors; no custom JSON channel required.
- We chose Konva to avoid the tldraw ↔ Yjs binding risk in 24h.
- We chose y-durableobjects to avoid bespoke WS protocol on DO.
- Keep Clerk with guest fallback; anonymous view-only always allowed.
