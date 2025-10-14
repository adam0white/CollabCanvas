# CollabCanvas

**A real-time collaborative canvas built with Cloudflare Workers, Durable Objects, Yjs, React, and Konva.**

CollabCanvas is a production-ready MVP demonstrating real-time collaboration with CRDT synchronization, role-based access control, and a modern web UI. Built incrementally through focused pull requests to maintain deployability at every step.

🔗 **Live Demo**: https://canvas.adamwhite.work/

---

## Features

✅ **Real-time Collaboration**: Multiple users can simultaneously create and edit rectangles with instant sync  
✅ **Cursor Presence**: See collaborators' cursors and names in real-time  
✅ **Authentication**: Clerk-powered auth with guest view-only access  
✅ **CRDT Sync**: Yjs provides conflict-free replicated data types for reliable merge semantics  
✅ **Offline Support**: Yjs buffers changes offline and merges on reconnect  
✅ **Transform Operations**: Create, move, resize, rotate, and delete shapes  
✅ **Pan & Zoom**: Navigate large canvases with mouse wheel zoom and drag panning  
✅ **Responsive Design**: Canvas adapts to window size with floating toolbar  
✅ **Security**: CSP headers, XSS protection, role-based mutation enforcement

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (for deployment)
- Clerk account (for authentication)

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Install frontend dependencies
npm --prefix web install

# 3. Set up Clerk keys
# Create a .dev.vars file in the root directory:
echo 'CLERK_SECRET_KEY="your_clerk_secret_key"' > .env

# 4. Start the development server
npm run dev

# In a separate terminal, start the frontend dev server
npm run frontend:dev
```

The app will be available at:
- **Worker**: http://localhost:8787/c/main
- **Frontend Dev**: http://localhost:5173

### Running Tests

```bash
# Run all tests
npm test

# Run frontend tests
npm run frontend:test

# Lint the codebase
npm run lint

# Format code
npm run format
```

---

## Architecture

### System Overview

```
┌─────────────┐          ┌──────────────────┐
│   Browser   │ ◄──WS───►│ Cloudflare Worker│
│  (React +   │          │   + Durable      │
│   Konva)    │          │     Objects      │
└─────────────┘          └──────────────────┘
      │                           │
      │                           │
   Yjs Sync                  y-durableobjects
   Awareness                 Persistence Layer
```

### Core Technologies

- **Frontend**: React 18, Konva (canvas rendering), Vite (build), Clerk (auth)
- **Backend**: Cloudflare Workers, Durable Objects (stateful WebSocket coordination)
- **Real-time**: Yjs (CRDT), y-protocols (awareness), y-durableobjects (DO integration)
- **Tooling**: TypeScript, Vitest, Biome (lint/format), Wrangler (deploy)

### Authentication & Authorization

**Clerk Integration**: The frontend uses `@clerk/clerk-react` for user authentication with a modal sign-in flow.

**Role-Based Access Control**:
- **Authenticated Users** → `editor` role: Can create, move, resize, rotate, and delete shapes
- **Guest Users** → `viewer` role: Read-only access; can view real-time updates but cannot edit

**Token Flow**:
1. Frontend obtains JWT from Clerk
2. JWT passed to Worker via WebSocket query parameter
3. Worker verifies JWT with `@clerk/backend` (JWKS validation)
4. Role assigned and passed to Durable Object via `x-collabcanvas-role` header
5. Durable Object enforces edit gating at the protocol level (blocks Yjs updates from viewers)

### Real-time Collaboration

**Yjs CRDT**: Provides automatic conflict resolution for concurrent edits. Each shape is stored as a JSON object in a `Y.Map`, keyed by shape ID.

**Awareness Protocol**: Tracks ephemeral presence data (cursors, user colors, display names) using Yjs Awareness. Updates are throttled client-side to 50ms (20 msgs/sec max).

**Persistence**: Yjs updates are committed to Durable Object storage with a debounced strategy:
- **Idle threshold**: 500ms (commit after 500ms of inactivity)
- **Max threshold**: 2s (force commit every 2s regardless of activity)

**Role Enforcement**: Durable Objects inspect incoming Yjs sync messages:
- Viewers: Awareness updates allowed, document updates blocked
- Editors: Full access to document updates

### Frontend Architecture

**Modular Hooks**:
- `usePresence`: Manages cursor positions, user colors, and display names
- `useShapes`: Syncs Yjs `Y.Map` with React state for shape rendering
- `useToolbar`: Shared tool state (Select, Rectangle) via React Context
- `useConnectionStatus`: Exposes WebSocket connection state (connecting, connected, disconnected)

**Konva Rendering**:
- `Canvas.tsx`: Main stage with pan/zoom, grid background, and interaction handlers
- `ShapeLayer.tsx`: Renders shapes from Yjs state, handles drag/resize/rotate with real-time broadcasting
- `Transformer`: Konva's built-in transformer for resize handles and rotation

**Security**:
- Display names sanitized to prevent XSS (removes `<`, `>`, `'`, `"`, `&` and limits length)
- CSP headers enforce script/style/img/connect source restrictions
- X-Frame-Options: DENY to prevent clickjacking
- X-Content-Type-Options: nosniff to prevent MIME sniffing

### WebSocket Routes

- `/c/main` → Serves the SPA (index.html with Clerk key injection)
- `/c/main/ws` → WebSocket endpoint for room "main"
- `/clerk/config` → Returns Clerk publishable key for frontend configuration
- `/health` → Health check endpoint

---

## Deployment

### Setting Secrets

```bash
# Set Clerk secret key (required for production)
wrangler secret put CLERK_SECRET_KEY
```

### Deploy to Cloudflare

```bash
# Deploy Worker + Durable Objects
npm run deploy
```

The `deploy` script automatically:
1. Installs frontend dependencies (`npm --prefix web ci`)
2. Builds the frontend (`npm --prefix web run build`)
3. Type-checks the Worker (`tsc -p tsconfig.json`)
4. Deploys via Wrangler

### Environment Variables

**Production** (set via `wrangler secret`):
- `CLERK_SECRET_KEY`: Clerk secret key for JWT verification

**Build-time** (defined in `wrangler.toml`):
- `CLERK_PUBLISHABLE_KEY`: Injected into HTML for frontend Clerk initialization

### Durable Object Migrations

Durable Object migrations are defined in `wrangler.toml`. Current migration tag: `v1`.

```toml
[[migrations]]
tag = "v1"
new_classes = ["RoomDO"]
```

If you modify the Durable Object class structure, increment the tag and add a new migration entry.

---

## Troubleshooting

### WebSocket Connection Issues

**Symptom**: "Disconnected" status in UI; shapes not syncing

**Possible Causes**:
- `CLERK_SECRET_KEY` not set (check Cloudflare dashboard → Worker → Settings → Variables)
- Invalid JWT token (check browser console for auth errors)
- Firewall blocking WebSocket connections

**Debug Steps**:
```bash
# 1. Check Worker logs
wrangler tail

# 2. Verify CLERK_SECRET_KEY is set (should not show "not configured" warning)
# 3. Check browser console for WebSocket errors
# 4. Test /health endpoint
curl https://canvas.adamwhite.work/health
```

### Shapes Not Persisting

**Symptom**: Shapes disappear on page reload

**Possible Causes**:
- Authenticated user required to create shapes (guests are view-only)
- Durable Object storage not committing (check Worker logs for commit errors)

**Debug Steps**:
1. Ensure you're signed in via Clerk
2. Check connection status badge in header (should be green "Connected")
3. Verify role assignment in Worker logs: `[RoomDO] Editor connected`

### Build Failures

**Symptom**: `npm run build` or `npm run deploy` fails

**Common Issues**:
- Missing `worker-configuration.d.ts`: Commit this file to the repo (it's generated by `wrangler types`)
- Frontend dependencies not installed: Run `npm --prefix web ci`
- Type errors: Run `npx tsc --noEmit` for detailed error output

### Performance Issues

**Symptom**: Lag or stuttering during heavy editing

**Expected Behavior**:
- Cursor updates throttled to 50ms (20 msgs/sec)
- Shape drag updates throttled to 50ms
- 60 FPS rendering target

**Debug Steps**:
1. Open browser DevTools → Performance tab
2. Record a session with heavy editing
3. Look for frame drops (should maintain ~60 FPS)
4. Check Network tab → WS frame rate (should be ≤30 msgs/sec)

---

## Demo Script

### Manual Testing Checklist

**Single User (Basic Functionality)**:
1. ✅ Open `/c/main` as guest → verify "Sign In" button visible
2. ✅ Hover over canvas → verify cursor position updates
3. ✅ Click "Sign In" → authenticate with Clerk → redirected to `/c/main`
4. ✅ Select Rectangle tool → click and drag → verify dashed preview and final shape creation
5. ✅ Select Select tool → click and drag shape → verify movement
6. ✅ Click shape → verify resize handles and rotation handle appear
7. ✅ Resize shape → verify dimensions update smoothly
8. ✅ Rotate shape → verify rotation updates smoothly
9. ✅ Select shape → press Delete or Backspace → verify shape removed
10. ✅ Zoom with mouse wheel → verify canvas scales
11. ✅ Drag canvas in Select mode (empty space) → verify panning
12. ✅ Click zoom reset button → verify canvas returns to 100%
13. ✅ Refresh page → verify shapes persist

**Multi-User (Collaboration)**:
1. ✅ Open `/c/main` in two browsers (or incognito)
2. ✅ Browser A: Create a shape → verify it appears in Browser B instantly
3. ✅ Browser A: Move cursor → verify colored cursor dot + name label in Browser B
4. ✅ Browser B (guest): Attempt to create shape → verify Rectangle tool is disabled
5. ✅ Browser B (guest): Attempt to drag shape → verify it doesn't move
6. ✅ Browser A: Resize shape → verify Browser B sees real-time updates
7. ✅ Browser A: Rotate shape → verify Browser B sees rotation updates
8. ✅ Browser A: Delete shape → verify it disappears in Browser B
9. ✅ Browser B: Pan canvas → verify cursor indicator appears at edge for off-screen collaborators

**Offline/Reconnection**:
1. ✅ Browser A: Create a shape
2. ✅ Browser A: Open DevTools → Network tab → Throttle to "Offline"
3. ✅ Browser A: Create more shapes (offline) → verify "Disconnected" status in header
4. ✅ Browser A: Re-enable network → verify "Connected" status and shapes sync to Browser B
5. ✅ Verify no shape duplicates or lost edits

---

## Project Structure

```
/
├── src/                    # Cloudflare Worker + Durable Object source
│   ├── worker.ts           # Main worker fetch handler, auth, routing
│   ├── room-do.ts          # RoomDO Durable Object (Yjs sync + awareness)
│   ├── utils/              # Shared utilities
│   │   └── debounced-storage.ts  # Debounced commit controller
│   └── *.test.ts           # Vitest tests for Worker/DO
│
├── web/                    # Frontend React app
│   ├── src/
│   │   ├── ui/             # React components (App, Canvas, Toolbar, etc.)
│   │   ├── hooks/          # React hooks (usePresence, useToolbar, etc.)
│   │   ├── shapes/         # Shape types, ShapeLayer, useShapes hook
│   │   ├── yjs/            # Yjs client, WebSocket provider setup
│   │   └── main.tsx        # Entry point (Clerk + Yjs providers)
│   ├── dist/               # Build output (served by Worker)
│   └── package.json        # Frontend dependencies
│
├── wrangler.toml           # Cloudflare Worker configuration
├── package.json            # Root dependencies (Worker, tooling)
├── tsconfig.json           # TypeScript config for Worker
├── vitest.config.ts        # Vitest config for Worker tests
├── tasks.md                # PR plan and task breakdown
└── README.md               # This file
```

---

## Contributing

This project was built as an MVP following the incremental PR plan in `tasks.md`. Each PR is designed to compile independently and keep `main` deployable.

**PR History**:
- PR1: Repo bootstrap, tooling (TypeScript, Vitest, Biome)
- PR2: Wrangler + Durable Object skeleton
- PR3: y-durableobjects + Awareness (presence/cursors)
- PR4: React + Vite + Konva SPA
- PR5: Clerk frontend + Worker JWT verification
- PR6: Client Yjs wiring (awareness + sync)
- PR7: Shapes (rectangle create/move/resize/rotate/delete via Yjs + Konva)
- PR8: Offline/resync, performance, security, docs ← **You are here**
- PR9: Cleanup, refactor, extendability (upcoming)

---

## License

MIT

---

## Acknowledgments

- **Yjs**: Conflict-free replicated data types for real-time collaboration
- **Cloudflare Workers**: Edge compute platform for low-latency WebSocket coordination
- **Clerk**: Drop-in authentication with JWT verification
- **Konva**: Canvas rendering library with transform operations
- **y-durableobjects**: Yjs persistence adapter for Durable Objects

Built by Adam White as a demonstration of real-time collaborative editing with modern web technologies.
