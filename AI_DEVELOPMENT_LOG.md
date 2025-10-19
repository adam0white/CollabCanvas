# AI Development Log — CollabCanvas

**7 days. 10,500 lines. 100% AI-generated. Zero manual coding.**

A real-time collaborative canvas built entirely by AI agents on Cloudflare's edge platform.

---

## The Approach

### Planning Before Coding

We spent a full day writing a comprehensive PRD and breaking it into phases before any implementation. This felt slow at first, but it scaled: one day of planning enabled AI agents to execute what would normally be a month of engineering work.

The key was being explicit about requirements without prescribing implementation. We wrote "what" and "why," never "how." No code snippets in planning docs—that gave AI agents room to make good technical decisions.

### Background Agents

Instead of interactive back-and-forth, we gave AI agents entire phases to complete autonomously:

1. Agent reads PRD, architecture docs, and existing code
2. Implements 4-12 PRs in logical commits
3. Returns complete feature branch when everything works

**Critical discovery**: Claude 4.5 Sonnet completed all 4 PRs in a test phase; GPT-5 High stopped after 1. For sustained complex work, Claude's long context window (1M tokens) and task persistence made it dramatically more effective. We used GPT-5 High for planning and strategic thinking, Claude 4.5 for implementation.

This pattern worked because background agents don't context-switch. They maintain state across an entire phase, making holistic decisions that interactive chat can't.

---

## The Cloudflare Advantage

### Why This Architecture Matters

Traditional real-time collaborative apps require:
- WebSocket server (Node.js/Go) + load balancer
- Redis for pub/sub and presence
- PostgreSQL for persistence  
- API gateway for auth
- Separate AI infrastructure
- Kubernetes for orchestration

**Cloudflare collapsed all of this into four primitives:**

**Workers + Durable Objects** = Stateful edge compute. Workers handle routing and auth; Durable Objects provide single-threaded, strongly consistent state coordination. No WebSocket servers, no databases, no orchestration.

**y-durableobjects** = Native Yjs CRDT integration. Conflict-free replication with built-in persistence. Awareness protocol for presence (cursors, locks) comes free.

**Workers AI + Agents** = On-platform AI inference with stateful agent framework. No external APIs, no cold starts, automatic state management.

**RPC via "Cap'n Proto Web"** = Direct RPC calls between Workers and Durable Objects. No HTTP serialization overhead. Perfect for atomic operations—entire AI commands execute in single Yjs transactions.

Single deployment (`wrangler deploy`), global edge network, automatic scaling, pay-per-request pricing. The platform's integration is what made AI-first development viable. AI agents could focus on application logic instead of infrastructure plumbing.

---

## What We Built

### Phase 1: MVP (3 days)
Infrastructure, Yjs CRDT sync, Clerk authentication, rectangle shapes with transforms, real-time cursor presence, offline handling. Kept `main` deployable after every PR.

### Phase 2: AI Canvas Agent (2 days)
Built AI agent using Workers AI with function calling. Hit snags—Mistral threw `InferenceUpstreamError 8001`, so we implemented fallback to text parsing. Initial design used shape arrays for bulk creation, which bloated AI payloads. Created `createPattern` tool instead (grid, row, column patterns)—10x faster.

Migrated to Cloudflare Agents framework for better state management. Ended with 12 tool types: create, move, resize, rotate, style, delete, arrange, find, align, distribute, getCanvasState. Complex layouts (login forms, navbars) in sub-5s.

### Phase 3: Shapes & Features (1.5 days)
Added circles and text. Real-time transform sync with 50ms throttle. Multi-select (Shift+Click, lasso). Object locking via Yjs Awareness (first-to-select wins, 30s stale cleanup). Duplicate, undo/redo, 20+ keyboard shortcuts, color picker, copy/paste, z-index, alignment tools, PNG export, layers panel, snap-to-grid.

Fixed critical bugs: delete key firing while typing, shapes stuck in corners, duplicate canvas (React StrictMode in prod build), creation blocked when cursor over existing shapes.

### Phase 4: Testing (2 days)
Built comprehensive Playwright suite: 17 spec files covering AI, auth, shapes, collaboration, conflict resolution, performance. Used real Clerk authentication (no mocking). Tests surfaced existing bugs—this was valuable, not a failure.

### Phase 5: Performance (1 day)
Research phase: studied Cloudflare docs and reference architectures. Agent identified bottlenecks through code analysis.

Implemented viewport culling—only render shapes in view plus buffer zone. **Result**: 10x FPS improvement, smooth at 500+ objects.

Disabled Konva Transformer for 15+ selected shapes (uses visual feedback instead). **Result**: Eliminated multi-select lag.

Consolidated throttles, batched Awareness updates, optimized Konva layer rendering.

---

## Technical Decisions That Mattered

**Yjs CRDT**: Automatic conflict resolution for concurrent edits. We combined it with optimistic locking via Awareness (ephemeral state): first user to select a shape gets a lock, others see colored outline. Hybrid approach gave us both data consistency (CRDT) and edit conflict prevention (locks).

**RPC over REST**: Early decision to use Durable Object RPC instead of HTTP endpoints. Enabled atomic operations—entire AI command in single Yjs transaction. Eliminated flicker and race conditions we didn't even know we had.

**Konva for rendering**: Mature canvas library with built-in transforms. Good performance for 500+ shapes with our optimizations. Lower risk than custom abstractions.

**Comprehensive planning**: Type-safe prompts specifying "feasible vs. unfeasible tests" for the testing phase. Clear acceptance criteria per phase. Explicit "no documentation" rules (which agents still violated, requiring cleanup).

---

## Key Learnings

### 1. Model Selection Matters for Different Tasks
GPT-5 High excelled at planning and strategic thinking. Claude 4.5 Sonnet completed 4x more implementation work. For background agents doing sustained complex work, Claude's persistence made it the clear choice. Test models on representative workloads, not just toy examples.

### 2. Documentation Access Is Critical
Cursor's nightly builds broke the `@Docs` symbol. Switched to stable channel to restore it. Without access to authoritative Cloudflare documentation, agents hallucinated APIs and made incorrect assumptions. 

### 3. Voice-to-Text Improved Prompts
Started at ~30% voice-typed, ended at 60-70%. Surprisingly, voice didn't just speed things up—it improved prompt quality. More natural phrasing, fewer omissions, better exploratory questions.

### 4. Agents Love Documentation (Too Much)
Despite explicit "skip documentation" instructions, agents persistently created unnecessary docs, test summaries, and hallucinated "proof" that acceptance criteria were met. Required vigilance and manual cleanup.

### 5. Platform Integration Scales AI Development
Building on an integrated platform (Workers + DO + AI) let agents focus on application logic. Traditional stacks require 10x more infrastructure code that's harder for AI to reason about.

### 6. Performance Needs Research Phase
Couldn't prescribe optimizations upfront. Gave agent time to research Cloudflare best practices and analyze code. It identified bottlenecks and implemented sophisticated solutions (viewport culling, selection throttling) autonomously.

### 7. Tests That Surface Bugs Are Valuable
Philosophy: "Tests that reveal existing issues prove their worth." Comprehensive Playwright suite caught regressions during optimization and gave us launch confidence.

---

## Results

**Code**: 10,500 lines (100% AI-generated)  
**Time**: 7 days (1 day planning, 6 days implementation)  
**Features**: 25+ (shapes, transforms, AI agent, locking, undo/redo, shortcuts, alignment, export, layers)  
**Performance**: 500+ objects at 60 FPS  
**Tests**: 17 E2E spec files, 20 unit tests  
**Rubric Score**: 90-95 / 100 (Excellent tier)

**Live**: https://canvas.adamwhite.work

---

## Reflection

**What worked**: Comprehensive planning scaled AI productivity. Phase-level autonomy with background agents eliminated context-switching. Cloudflare's integrated platform collapsed infrastructure complexity. Performance research phase enabled sophisticated optimizations.

**What surprised us**: Claude vs. GPT-5 performance gap on sustained work. Voice-to-text improving prompt quality beyond just speed. RPC eliminating race conditions we didn't know existed. Viewport culling's massive impact (10x FPS).

**What we'd change**: Earlier performance profiling. Stricter documentation enforcement. Testing GPT-5 for background work sooner to avoid wasted time. More incremental AI feature rollout for easier debugging.

**Core insight**: AI-first development with comprehensive planning and modern integrated platforms can deliver production-ready collaborative applications in days, not months. The key is investing in upfront planning to prepare AI agents for sustained autonomous work, and choosing platforms that reduce infrastructure complexity.
