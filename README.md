# CollabCanvas

Collaborative whiteboard MVP built with Cloudflare Workers, Durable Objects, Yjs, and a React/Konva frontend. This repository tracks the work for building the MVP in incremental pull requests.

## Getting Started

```bash
npm install
npm run build
npm test
npm run dev
```

## Scripts
- `npm run dev` — generate Worker types and start `wrangler dev`.
- `npm run build` — regenerate Worker types and type-check via TypeScript.
- `npm test` — regenerate Worker types and run the Vitest test suite.
- `npm run lint` — run Biome checks across the repository.
- `npm run format` — format files with Biome.
- `npm run deploy` — deploy the Worker using Wrangler.

## Architecture

### Authentication & Authorization (PR5-6)

- **Clerk Integration**: Frontend uses `@clerk/clerk-react` for authentication
- **Role-Based Access**: Worker verifies JWT tokens with `@clerk/backend` and assigns roles:
  - `editor`: Authenticated users can apply Yjs document updates
  - `viewer`: Unauthenticated users or invalid tokens are read-only (receive sync but cannot mutate)
- **WebSocket Token Flow**: JWT passed via WebSocket query params for server-side role assignment

### Real-time Collaboration (PR3-6)

- **Yjs Document Sync**: Built on `y-durableobjects` for automatic CRDT synchronization
- **Awareness Protocol**: Tracks presence (cursors, user info) via Yjs Awareness, throttled client-side at 50ms
- **Persistence**: Debounced commits to Durable Object storage (500ms idle / 2s max window)
- **Role Enforcement**: Durable Object filters incoming Yjs updates based on client role (viewers blocked from mutations)

### WebSocket Routes

- `/c/{roomId}/ws` — WebSocket endpoint for room collaboration
- Role header `x-collabcanvas-role` set by worker based on JWT verification
- Unexpected paths rejected before routing to Durable Object

## Development Notes

- Cloudflare types are generated with `wrangler types`; scripts handle this automatically. If the Worker bindings change, rerun `npm run wrangler:types`.
- `wrangler.toml` mounts static assets from `web/dist`. Build the frontend with `npm --prefix web run build` before deploying.
- Durable Object stubs live in `src/room-do.ts`; `src/worker.ts` re-exports the class for Wrangler binding resolution.
- Yjs client provider in `web/src/yjs/client.tsx` handles connection lifecycle, token refresh, and automatic reconnection.

## License

MIT

