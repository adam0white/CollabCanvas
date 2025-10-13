### CollabCanvas MVP — Architecture Overview

```mermaid
flowchart TB
  subgraph Clients[Browsers]
    A["User A
React + Vite + Konva
Yjs Doc (client) + Awareness"]
    B["User B
React + Vite + Konva
Yjs Doc (client) + Awareness"]
  end

  subgraph Worker[Cloudflare Worker]
    W["fetch routing
/health, /c/main, /c/main/ws
serve web/dist (SPA)"]
  end

  subgraph Room[Durable Object: RoomDO]
    D["RoomDO
Yjs sync + Awareness
(y-durableobjects)
Presence + Broadcast
Backpressure for cursors
CRDT merges"]
    S["DO Storage
Yjs snapshot (debounced)
metadata"]
  end

  subgraph Auth[Clerk]
    K["Clerk JWKS verify JWT
(@clerk/backend)"]
  end

  subgraph CI[Cloudflare Git Integration]
    G["Build + Deploy on push to main"]
  end

  %% HTTP SPA
  A -->|"GET /c/main"| W
  B -->|"GET /c/main"| W
  W -->|"serve SPA (web/dist)"| A
  W -->|"serve SPA (web/dist)"| B

  %% Auth + WS upgrade
  A -.->|"WS /c/main/ws
JWT (query/header)"| W
  B -.->|"WS /c/main/ws
JWT (query/header)"| W
  W -->|"verify JWT (if present)"| K
  W -->|"route to RoomDO"| D

  %% Yjs data flows
  A ===>|"Yjs sync/update (binary)"| D
  B ===>|"Yjs sync/update (binary)"| D
  A -.->|"Yjs Awareness (presence/cursor)"| D
  B -.->|"Yjs Awareness (presence/cursor)"| D
  D -->|"broadcast Yjs updates (binary)"| A
  D -->|"broadcast Yjs updates (binary)"| B
  D -->|"broadcast Awareness"| A
  D -->|"broadcast Awareness"| B

  %% Persistence
  D -->|"debounced snapshot
(≥500ms idle / ≤2s window)"| S
  S -->|"load on init"| D

  %% Edit gating
  W -->|"editable if JWT valid
view-only otherwise"| D

  %% CI
  G -->|"auto build + deploy"| W
```

Key points
- Single room for MVP: `/c/main` → one `RoomDO` instance.
- Auth: Clerk JWT on WS upgrade; edit requires valid token; view-only for anonymous.
- Realtime: Yjs (sync/update) for document state; Awareness for presence/cursors (20 Hz throttle client-side).
- Persistence: DO storage holds debounced Yjs snapshot; restore on DO init.
- Backpressure: drop/merge stale Awareness frames; coalesce transforms.
- CI/CD: Cloudflare Git integration builds/deploys on push to `main`.
