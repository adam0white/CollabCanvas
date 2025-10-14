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

## Development Notes

- Cloudflare types are generated with `wrangler types`; scripts handle this automatically. If the Worker bindings change, rerun `npm run wrangler:types`.
- `wrangler.toml` mounts static assets from `web/dist`. Until the Vite build exists, a placeholder `web/dist/index.html` is served so `/c/main` responds during development.
- Durable Object stubs live in `src/room-do.ts`; `src/worker.ts` re-exports the class for Wrangler binding resolution.

## License

MIT

