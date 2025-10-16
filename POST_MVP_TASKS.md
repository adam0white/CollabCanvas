# CollabCanvas Post-MVP Task List

**Timeline**: 3.5 days (estimate: 17 PRs for "Good", +7 PRs for "Excellent/Stretch")  
**Platform**: Cloudflare Workers + Durable Objects + Workers AI  
**Current State**: MVP complete (rectangles, real-time sync, auth, basic transforms, deployment)  
**Target**: 80-89 points (Good) → 90-100+ points (Excellent)

---

## Critical Notes

### Principles
1. **Always Keep Working**: Every PR must leave app in deployable state
2. **Test After Each PR**: Run `npm test`, deploy to preview, ask for a manual 2-browser testing
3. **No Breaking Changes**: Maintain backward compatibility with existing shapes/features
4. **Security First**: JWT verification for all AI routes, sanitize inputs, validate outputs
5. **Atomic Writes**: AI commands use single Yjs transaction to prevent flicker and meet latency targets

### Priority Levels
- **REQUIRED for "Good" (80-89 points)**: PR10-27 - Must complete all
- **STRETCH for "Excellent" (90-100+)**: PR28-36 - Opt-in only, no scope creep
- **Focus**: Ship solid "Good" first, then iterate to "Excellent" if time permits

### Architecture Context
- **Backend**: Cloudflare Worker (src/) handles HTTP/WS routing, JWT verification
- **Durable Object**: RoomDO (src/room-do.ts) manages Yjs state + Awareness + persistence
- **Frontend**: React + Vite + Konva (web/src/) renders canvas, syncs via Yjs WebSocket provider
- **Sync Protocol**: Yjs CRDT for shapes (Y.Map), Yjs Awareness for presence/cursors/locks
- **Auth**: Clerk (frontend + @clerk/backend for JWT verification)

### Current Code Realities
- **Shapes**: Currently rectangle-only (src/shapes/types.ts lines 11-16)
- **Rendering**: ShapeLayer.tsx only renders Konva.Rect (lines 154-171)
- **Tools**: useToolbar.tsx only has 'select' | 'rectangle' (lines 14-16)
- **No AI endpoint yet**: Need Worker route + DO handler for Yjs mutations
- **Plan must expand**: types, rendering, tool state, useShapes serializer for new shape fields

### Standard API Contracts (RPC via Durable Objects)
- **Worker Route**: `POST /c/:roomId/ai-command` (JWT editor-only, thin wrapper)
- **DO RPC Method**: `stub.executeAICommand({ commandId, prompt, context, userId, userName })`
  - Direct RPC call to Durable Object (no internal HTTP route)
  - Executes tools + updates Yjs in single atomic transaction
  - Returns: `{ success, message, shapesCreated, shapesAffected, error?, commandId }`
- **Tool Envelope**: Tools executed by DO, results applied to Yjs atomically
- **Idempotency**: DO tracks commandId in memory, returns cached result if replay
- **Bounds**: Max 50 shapes per command (reject 100+ with error)
- **Error Codes**: 400 (bad input), 401 (auth), 500 (server)

### Constants & Normalization (Define Once, Reuse Everywhere)
- **Throttle Config**: Export from `web/src/config/constants.ts`:
  - `PRESENCE_THROTTLE_MS = 50` (cursor updates)
  - `TRANSFORM_THROTTLE_MS = 50` (drag/resize/rotate)
  - `COLOR_CHANGE_THROTTLE_MS = 100`
  - Target: ≤20 msgs/sec per client for transforms
- **Layout Operations**: `type Layout = 'horizontal' | 'vertical' | 'grid'` with default spacing 20px
- **Rotation**: Always degrees (number type, not string)
- **Color Normalization**: Map common names to hex ("purple" → "#800080", "red" → "#FF0000")
- **AI Metadata**: All AI-created shapes get `createdBy: "ai-assistant"` and `createdAt: timestamp`

### Standard Definition of Done (All PRs)
- [ ] `npm test` passes (root and web/)
- [ ] `npm run build` succeeds (typecheck clean)
- [ ] `biome format` and `biome check` pass
- [ ] Deploy preview loads without console errors
- [ ] Manual 2-browser test (simultaneous editing, sync verified)
- [ ] No regressions to existing features

### Testing Strategy
- **Unit Tests**: Vitest for backend logic, shape utilities, AI tool functions
- **Integration Tests**: Test AI command → DO atomic transaction → Yjs sync → clients
- **Manual Tests**: Document scenarios per PR, test with 2+ browser windows
- **Performance Gates**: FPS monitoring, message rate checks

### Parallelization Map (Workstreams)
- **Backend AI** (PR10-13): Can start immediately, add DO route early
- **Shapes** (PR14-16): Independent once types agreed, minimal AI coupling
- **Selection & Locking** (PR17-19): Independent of AI, coordinate transformer changes
- **Tier 1 Features** (PR20-24): Parallel with selection once multi-select basics land
- **Docs/Perf** (PR25-27): Ongoing, finalize at end

---

## PHASE 1: AI Canvas Agent (Priority - 25 points)

### PR10 — Workers AI Integration + Basic Tools
**Goal**: Set up Workers AI infrastructure and implement 3 foundational tools with atomic DO mutations

**Why This First**: AI is worth 25% of grade and needs early validation. If Workers AI isn't capable enough, we need to know now to switch to BYOK OpenAI.

**Backend Requirements**:

**1. Worker Route** (`src/worker.ts`):
- Add route: `POST /c/:roomId/ai-command`
- Extract and verify JWT (editors only, 401 for guests/invalid)
- Validate request body: prompt (max 1000 chars), context (selectedShapeIds, viewportCenter)
- Sanitize prompt (strip HTML, dangerous characters)
- Generate unique commandId (UUID v4)
- Get DO stub for roomId
- Call Workers AI with tool schema (or OpenAI if BYOK)
- Call `stub.executeAICommand({ commandId, prompt, context, toolResults, userId, userName })` via RPC
- Return DO response directly to client

**2. Durable Object RPC Method** (`src/room-do.ts`):
- Add RPC method: `executeAICommand(params)`
- Accept: commandId, toolResults array, userId, userName, context
- Check idempotency: if commandId seen before, return cached result
- Execute all tools within **single Yjs transaction** (atomic commit)
- Validate bounds: reject if total shapes would exceed 50 per command
- Append to aiHistory Y.Array within same transaction
- Cache result with commandId for idempotency
- Return success/error with shape IDs

**3. AI Tools Module** (`src/ai-tools.ts`):
- Define tool schema for Workers AI function calling
- Three initial tools:
  - `createShape`: Creates rectangle/circle/text at position with style
  - `moveShape`: Updates shape x, y by ID
  - `getCanvasState`: Returns all shapes with properties for context
- Tool dispatcher function routing tool name → implementation
- Each tool validates parameters and returns result object
- Set metadata: `createdBy: "ai-assistant"`, `createdAt: Date.now()`

**4. Wrangler Config** (`wrangler.toml`):
- Add Workers AI binding or configure BYOK credentials
- Expose via Env interface

**Tool Schema Example**:
```
{
  name: "createShape",
  description: "Creates a new shape on the canvas",
  parameters: {
    type: "object",
    properties: {
      type: { enum: ["rectangle", "circle", "text"] },
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      radius: { type: "number" },
      text: { type: "string" },
      fill: { type: "string", description: "Hex color" }
    }
  }
}
```

**Frontend Requirements**:

**1. Hook** (`web/src/hooks/useAI.ts`):
- Send POST to `/c/:roomId/ai-command` with prompt and context
- Handle loading state, errors, success
- Include commandId for tracking
- Timeout after 10s

**2. UI Component** (`web/src/ui/AIPanel.tsx`):
- Text input for prompts (multiline textarea)
- Submit button (disabled for guests with tooltip: "Sign in to use AI")
- Loading indicator: "AI is thinking..." with animated dots
- Success toast: "Created 3 shapes" or "Moved rectangle"
- Error display: inline error message if command fails

**Critical Implementation Details**:
- **Atomic Writes**: All tool executions in single Yjs transaction to prevent flicker
- **Idempotency**: Check commandId; if replay, return cached result
- **Bounds Enforcement**: Hard limit 50 shapes per command, reject with error if exceeded
- **Color Normalization**: Convert common names ("red") to hex ("#FF0000") before storing

**Acceptance Criteria**:
- [ ] "Create a red rectangle at 100, 200" works, syncs atomically to all users
- [ ] "Move shape-{id} to 500, 500" updates position
- [ ] Commands complete in <2s for simple operations
- [ ] Guest users see disabled input with clear tooltip
- [ ] Errors display helpful messages (e.g., "Shape not found")
- [ ] Unit tests cover: tool dispatch, sanitization, bounds validation, atomic commits
- [ ] App remains stable if Workers AI unavailable (shows error, doesn't crash)
- [ ] Single Yjs update per command (verify in network tab)

---

### PR11 — Manipulation & Layout AI Tools
**Goal**: Expand to 8+ distinct command types with idempotency and color normalization

**Why This Matters**: Rubric requires minimum 6 command types across categories. This PR covers "manipulation" and "layout" categories, completing the breadth requirement.

**Backend Requirements** (`src/ai-tools.ts`):

**Add 5 New Tools**:
1. `resizeShape(shapeId, width?, height?, radius?, scale?)`:
   - Explicit: `width: 200, height: 100`
   - Relative: `scale: 2` (doubles current size)
   - Validate: reject if resulting size < 10px or > 2000px
   
2. `rotateShape(shapeId, rotation)`:
   - Always in degrees (normalize to 0-360 range)
   - Handle negative: `-45` → `315`
   - Handle overflow: `405` → `45`

3. `updateShapeStyle(shapeId, fill?, stroke?, strokeWidth?)`:
   - **Color normalization required**: Map common names to hex
   - Use color table: `{ red: "#FF0000", blue: "#0000FF", purple: "#800080", green: "#00FF00" }`
   - Pass through hex/rgb unchanged (validate format)
   - Reject invalid colors with helpful error

4. `deleteShape(shapeId)`:
   - Remove from Yjs shapes map
   - Return success with deleted ID
   - Fail silently if shape doesn't exist (idempotent)

5. `arrangeShapes(shapeIds[], layout, spacing?, columns?)`:
   - Layouts: `'horizontal' | 'vertical' | 'grid'` (use type from constants)
   - Default spacing: 20px
   - Grid requires `columns` parameter
   - Calculate bounding box, position shapes relative to first shape's position

**Add Helper Tool**:
6. `findShapes(criteria: { type?, color?, contains? })`:
   - Pattern matching for "the blue rectangle"
   - Match by type AND color if both specified
   - Match by text content if text shape: `contains: "Hello"`
   - Return array of matching shape IDs
   - Handle ambiguity: return all matches (AI can refine)

**Idempotency**:
- Store `lastCommandId` and `lastResult` in DO memory (not Yjs)
- If incoming commandId matches lastCommandId, return cached result immediately
- Prevents duplicate execution if user retries or network duplicates request

**Atomic Batching**:
- All tool calls from single AI response execute in one Yjs transaction
- Wrapped in try/catch: rollback entire batch on any tool failure

**Frontend Requirements** (`web/src/hooks/useAI.ts`):
- Update toast messages: "Resized shape", "Rotated 45°", "Deleted 2 shapes", "Arranged 5 shapes horizontally"
- Show shape count and operation type
- Error messages: display AI's error explanation (e.g., "Couldn't find a blue rectangle")

**Acceptance Criteria**:
- [ ] "Resize the red rectangle to 200x300" works
- [ ] "Make the circle twice as big" doubles dimensions
- [ ] "Rotate the square 45 degrees" sets rotation correctly
- [ ] "Change the blue circle to green" normalizes color to hex
- [ ] "Delete all red shapes" uses findShapes + deleteShape
- [ ] "Arrange these shapes in a row" creates horizontal layout with 20px spacing
- [ ] Pattern matching finds correct shapes by type/color
- [ ] Idempotency: duplicate commandId returns same result without re-execution
- [ ] Unit tests: Each tool + findShapes logic + color normalization table
- [ ] All 8+ command types work end-to-end

---

### PR12 — AI History + Collaborative AI Experience
**Goal**: Implement shared AI history with Yjs and support concurrent multi-user AI commands

**Why This Matters**: Rubric specifically tests shared AI state. All users must see the same AI results. This proves multiplayer AI works correctly.

**Backend Requirements** (`src/room-do.ts`):

**Add to Yjs Document**:
- Create `aiHistory: Y.Array<HistoryEntry>` at DO initialization
- Schema for HistoryEntry:
  ```typescript
  {
    id: string,              // same as commandId
    userId: string,
    userName: string,
    prompt: string,
    response: string,        // AI's text response
    timestamp: number,
    shapesAffected: string[], // IDs of created/modified/deleted shapes
    success: boolean,
    error?: string
  }
  ```

**History Management**:
- Append entry to Y.Array at end of each AI command (within same transaction as tool execution)
- Limit history to last 100 entries (prune oldest when inserting 101st)
- Use Y.Array for automatic sync and persistence

**Concurrent Command Handling**:
- Each command has unique commandId (UUID v4)
- Commands execute in parallel (no queue)
- Each command appends to history independently
- Yjs ensures consistent history order across all clients

**Frontend Requirements**:

**Expand AIPanel** (`web/src/ui/AIPanel.tsx`):
- Split into two sections: Input (top) + History (bottom, scrollable)
- History section:
  - Show last 20-30 entries (load more on scroll or paginate)
  - Each entry displays: user avatar/name, timestamp (relative: "2m ago"), prompt, response
  - Visual distinction: current user's entries highlighted
  - Optional: click entry → highlight affected shapes with colored outline
- Auto-scroll to bottom when new entry added
- Guests see full history but input disabled

**Sync Logic** (`web/src/hooks/useAI.ts`):
- Observe `aiHistory` Y.Array for changes
- Convert Y.Array to React state for rendering
- Real-time: new entries from other users appear immediately
- Optimistic UI: show local command as "sending..." until confirmed in history

**Acceptance Criteria**:
- [ ] All users see identical history in real-time (verify with 2 browser windows)
- [ ] User A sends command → User B sees it appear in history within 100ms
- [ ] Two editors send commands simultaneously → both appear in history, no conflicts
- [ ] History persists across browser refresh
- [ ] Entries show clear context: who, when, what happened, which shapes affected
- [ ] Guest users see history but cannot send commands
- [ ] History scrolling works smoothly with 50+ entries
- [ ] No duplicate entries even under race conditions

---

### PR13 — Complex Commands + Spatial Context Understanding
**Goal**: Enable multi-step AI operations with batch creation and spatial reasoning

**Why This Matters**: Rubric awards highest points (7-8) for complex commands that "produce 3+ properly arranged elements". This is the difference between "Good" and "Excellent" on AI scoring.

**Backend Requirements** (`src/ai-tools.ts`):

**Add Batch Creation Helper**:
- `createMultipleShapes(shapes: ShapeSpec[])`: 
  - Accepts array of shape specifications
  - Creates all shapes in single call
  - Still atomic (all or nothing within Yjs transaction)
  - Returns array of created shape IDs
  - Example: login form → 3 shapes in one helper call

**Spatial Context Computation**:
Implement functions AI can use to understand references:
- `computeCenter()`: Returns canvas center or viewport center (use viewport from context if provided)
- `computeRelativePosition(baseShapeId, direction, offset)`: 
  - Direction: "above" | "below" | "left" | "right"
  - Finds base shape, calculates position with offset
  - Returns `{ x, y }` coordinates
- `getSelectedShapesBounds(shapeIds)`: Returns bounding box of selection
- `findClearSpace(width, height)`: Finds area without existing shapes (simple overlap detection)

**Smart Defaults**:
- Form fields: width 200px, height 40px, 10px vertical spacing
- Buttons: width 100px, height 40px
- Text labels: fontSize 16px for labels, 24px for titles
- Grid spacing: 20px default
- Default colors: shapes created together use same color for consistency

**Update AI System Prompt**:
- Teach AI to use batch creation for multi-shape operations
- Provide canvas dimensions (2000x2000px typically)
- Explain spatial helpers available
- Encourage AI to use relative positioning and smart defaults

**Frontend Requirements**:

**Enhanced Context** (`web/src/hooks/useAI.ts`):
- Include in request:
  - `selectedShapeIds`: array of selected shape IDs
  - `viewportCenter: { x, y }`: from Konva stage position
  - `canvasDimensions: { width, height }`
- Pass to backend with every command

**Visual Feedback**:
- Progress indicator for multi-step operations
- Optional: show shapes appearing progressively (if not atomic, keep atomic for now)
- Loading message: "Creating login form..." vs "AI is thinking..."

**Error Handling**:
- Transactional: if complex command fails midway, entire operation rolls back
- Error message explains what failed: "Couldn't create login form: too many shapes requested"

**Performance Targets** (from rubric):
- Simple commands: <2s response time
- Complex commands: <5s response time  
- 80%+ accuracy on test prompts

**Testing Complex Commands**:
- "Create a login form" → expect username field, password field, submit button (3 elements, vertically arranged)
- "Build a navigation bar with 4 items" → expect 4 text elements horizontally arranged
- "Create a 3x3 grid of circles" → expect 9 circles in perfect grid (spacing 20px)
- "Move these shapes to the center" → with 3 shapes selected, all move to canvas center maintaining relative positions

**Acceptance Criteria**:
- [ ] "Create a login form" generates 3+ properly sized and arranged elements
- [ ] "Build a navigation bar with 4 items" creates horizontal text layout
- [ ] "Create a 3x3 grid of squares" produces evenly spaced grid
- [ ] Context-aware: "move these to center" works with selected shapes
- [ ] Relative positioning: "create a circle below the red rectangle" computes correct position
- [ ] Smart defaults: form fields have reasonable sizes without explicit dimensions
- [ ] Complex commands complete within 5 seconds
- [ ] All shapes from single command created atomically (single Yjs update)
- [ ] Error handling: partial failures roll back entirely

---

## PHASE 2: Enhanced Canvas Features (15 points)

### PR14 — Circle & Text Shape Types
**Goal**: Expand to 3 shape types (rectangle, circle, text) in one PR

**Why Combined**: Both are shape type additions following same pattern. Combining reduces context switching and ensures consistent type system expansion.

**Why This Matters**: Rubric requires 3+ shape types for "Excellent" (7-8 points). This PR completes the requirement.

**Requirements**:

**Type System** (`web/src/shapes/types.ts`):
- Extend `ShapeType` union: `type ShapeType = 'rectangle' | 'circle' | 'text'`
- Add `CircleShape` interface:
  - Required: `id, type: 'circle', x, y, radius, fill, rotation, createdBy, createdAt, updatedAt`
  - Optional: `stroke, strokeWidth, opacity`
- Add `TextShape` interface:
  - Required: `id, type: 'text', x, y, text, fontSize, fill, rotation, createdBy, createdAt, updatedAt`
  - Optional: `fontFamily, align: 'left' | 'center' | 'right', width, stroke, strokeWidth`
- Add factories: `createCircle(x, y, radius, fill)`, `createText(x, y, text, fontSize?, fill?)`
- Add type guards: `isCircle()`, `isText()`
- Text defaults: `fontFamily: 'Arial'`, `fontSize: 16`, `align: 'left'`

**Serializer Updates** (`web/src/shapes/useShapes.ts`):
- **Critical**: Update serialization to handle circle and text fields
- Circle: `radius` field
- Text: `text, fontSize, fontFamily, align, width` fields
- Validation: circles `radius > 0`, text `text.length >= 1`, rectangles `width, height > 0`
- Empty text: prevent creation or auto-delete

**Rendering** (`web/src/shapes/ShapeLayer.tsx`):
- Add conditional rendering for both:
  - `if (isCircle(shape))` → render `Konva.Circle` with radius, maintain aspect ratio on resize
  - `if (isText(shape))` → render `Konva.Text` with text content, fontSize
- Text editing: double-click opens input overlay, blur/Enter commits
- Resize behavior: circles maintain aspect, text adjusts fontSize or width

**Toolbar** (`web/src/ui/Toolbar.tsx` + `web/src/hooks/useToolbar.tsx`):
- Extend tool union: `'select' | 'rectangle' | 'circle' | 'text'`
- Add circle and text buttons with icons
- Update tool state management

**Canvas Interactions** (`web/src/ui/Canvas.tsx`):
- Circle: click+drag from center, radius = distance from start, dashed preview
- Text: click places cursor, immediate input overlay, create on blur/Enter (cancel if empty)

**AI Integration**:
- Both already supported in `createShape` tool (PR10)
- Test: "Create a blue circle at 200, 300 with radius 50"
- Test: "Add a text that says 'Hello World'"

**Text Editing Conflicts**:
- Simple last-write-wins model (document in ARCHITECTURE.md)
- No real-time collaborative text editing within single text shape

**Testing**:
- Unit tests: factories, type guards, validation for both shapes
- Integration: creation, editing, sync for both
- Regression: rectangles still work

**Acceptance Criteria**:
- [ ] Circle: drag from center creates perfect circles, resize maintains aspect ratio
- [ ] Text: click+type creates text, double-click edits, empty text prevented
- [ ] Both shapes sync to all users in real-time
- [ ] All standard operations work for both: move, rotate, delete, duplicate, select, lock
- [ ] AI creates both: circles and text shapes
- [ ] Serializer correctly handles all fields for both shapes
- [ ] No regressions to rectangle functionality
- [ ] Tests pass for both circle and text logic

---

### PR15 — Real-Time Transform Sync
**Goal**: Use centralized throttle constants to broadcast smooth transform updates

**Why This Matters**: Currently transforms only sync on mouseup. Other users see shapes "jump" rather than move smoothly. Rubric emphasizes "sub-100ms object sync" and "zero visible lag".

**Requirements**:

**Create Constants Module** (`web/src/config/constants.ts`):
```typescript
export const THROTTLE = {
  PRESENCE_MS: 50,      // cursor updates (defined in Critical Notes)
  TRANSFORM_MS: 50,     // drag/resize/rotate
  COLOR_CHANGE_MS: 100, // style updates
} as const;

export const MESSAGE_RATE_TARGET = 20; // msgs/sec per operation max
```

**Update Transform Handlers** (`web/src/shapes/ShapeLayer.tsx`):
- Import `THROTTLE` from constants
- Throttle `onDragMove`, `onTransform` events using `THROTTLE.TRANSFORM_MS`
- Use existing throttle utility or create reusable `useThrottle` hook
- Ensure final `onDragEnd`, `onTransformEnd` always fire (not throttled)
- Apply to all 3 shape types: rectangles, circles, text

**Visual Feedback**:
- Shapes being transformed get visual indicator (options: slight opacity 0.8, colored outline, or subtle glow)
- Indicator appears during drag/resize/rotate, disappears on mouseup
- Helps users understand which shapes are "in-flight"

**Performance**:
- Target: ≤20 msgs/sec per operation (cursor + transform = 40 msgs/sec max per client)
- Monitor in network tab during manual testing
- Ensure throttling doesn't degrade local responsiveness (user sees immediate feedback)

**Integration with Locking**:
- Only lock holder broadcasts throttled updates
- Other users receive updates but can't interact with locked shape
- Lock prevents conflicting transforms

**Testing Requirements**:
- Manual: 2 users simultaneously transforming different shapes (both see smooth movement)
- Manual: User A drags shape, User B watches (sees continuous movement, not jumps)
- Performance: Monitor Yjs update rate during rapid drag
- Edge case: Quick click-drag-release (final position captured correctly)
- Network simulation: Throttle to Slow 3G, verify updates still arrive smoothly

**Acceptance Criteria**:
- [ ] Other users see smooth drag/resize/rotate (not jumps on mouseup)
- [ ] All 3 shape types support throttled transforms
- [ ] Constants imported from centralized module (no magic numbers)
- [ ] Visual indicator shows shapes being transformed
- [ ] Message rate ≤20/sec for transforms (verify in DevTools Network tab)
- [ ] Final state always sent on mouseup (not just throttled updates)
- [ ] Works with selection locking (only lock holder sends updates)
- [ ] No "snapping back" or rubber-banding artifacts
- [ ] Local interaction remains responsive (throttling doesn't add input lag)

---

## PHASE 3: Selection & Conflict Resolution (12 points)

### PR16 — Multi-Select & Lasso Selection
**Goal**: Complete selection system with multi-select (Shift+Click) and lasso (drag-to-select)

**Why Combined**: Both are selection features, share the same `selectedShapeIds` state, and lasso builds directly on multi-select foundation.

**Why This Matters**: Essential for productivity. Users need to select multiple shapes efficiently. Foundational for object locking (PR17).

**Requirements**:

**Selection State Refactor**:
- **Currently**: Single `selectedShapeId: string | null`
- **Change to**: `selectedShapeIds: string[]` array
- Update all selection logic to handle array
- Empty array = nothing selected

**Interactions**:
- Normal click: Clear array, select single shape (exclusive selection)
- Shift+Click: Toggle shape in/out of array (additive selection)
- Click selected shape again with Shift: removes from selection
- Click on empty canvas: clear selection (deselect all)

**Visual Feedback**:
- All shapes in `selectedShapeIds` array show selection outlines
- Use Konva Transformer on all selected nodes simultaneously
- Transformer calculates bounding box encompassing all selected shapes

**Group Operations**:
- **Drag**: Move all selected shapes together, maintaining relative positions
  - Calculate offset from drag start, apply to each shape's x, y
- **Delete**: Remove all selected shapes from Yjs map
- **Resize**: Scale all shapes relative to bounding box center
- **Rotate**: Rotate all shapes around bounding box center
- All group operations are atomic (single Yjs transaction)

**Keyboard Commands**:
- Escape: clear selection (`selectedShapeIds = []`)
- Cmd+A: select all shapes (populate array with all shape IDs)
- Works with existing Delete key (removes all selected)

**Selection Persistence**:
- Selection is local per-user (not in Yjs - each user has independent selection)
- If selected shape gets deleted by another user, remove from local selection array
- Subscribe to Yjs shape deletions, filter deleted IDs from selection

**Lasso Selection** (Drag-to-Select Rectangle):
- When Select tool active, drag on empty canvas (not on shape)
- Draw dashed selection rectangle during drag
- On mouseup, select all shapes with centers inside rectangle
- Shift+lasso: additive (adds to existing selection without clearing)
- Selection count display: "5 shapes selected"
- Distinguish from pan gesture: detect intent from drag distance or use modifier key

**Interaction Design**:
- Lasso vs pan: simple heuristic (drag on shape = move, drag on empty = lasso)
- Shape inclusion: use center point (simpler) or any overlap (more intuitive - implementer's choice)
- Visual: dashed blue rectangle during drag

**Acceptance Criteria**:
- [ ] Single shape selection works (click shape → array contains one ID)
- [ ] Shift+Click adds/removes shapes from selection array
- [ ] All selected shapes show visual indicators simultaneously
- [ ] Dragging any selected shape moves entire group (relative positions maintained)
- [ ] Resize/rotate handles encompass all selected shapes (bounding box transform)
- [ ] Delete key removes all selected shapes atomically
- [ ] Escape clears selection, Cmd+A selects all
- [ ] Lasso: drag on empty canvas draws selection rectangle
- [ ] Lasso: shapes inside rectangle get selected on release
- [ ] Shift+lasso adds to existing selection (doesn't clear)
- [ ] Selection count indicator shows "X shapes selected"
- [ ] Lasso doesn't conflict with pan/zoom gestures
- [ ] Works with all 3 shape types (rectangles, circles, text)
- [ ] Selection survives other users' edits (except deleted shapes)
- [ ] Group operations are undoable (single undo reverts entire group operation)
- [ ] No regressions to single-select behavior

---

### PR17 — Selection-Based Object Locking
**Goal**: Prevent simultaneous editing conflicts through optimistic locking with visual feedback

**Why Critical**: Rubric Section 1 "Conflict Resolution & State Management" worth 9 points. Must document strategy and demonstrate that "Two users edit same object simultaneously → both see consistent final state".

**Requirements**:
- Lock mechanism using Yjs Awareness (ephemeral, per-user state)
- Selection creates lock automatically (selecting shapes broadcasts lock to all users)
- Lock data includes: shape IDs, user ID, user name, timestamp
- Locks are released automatically on deselection or user disconnect
- Other users see locked shapes with visual indicators (colored outline matching lock holder's presence color)
- Locked shapes cannot be selected or transformed by other users (interactions blocked)
- Hover tooltip shows who has the lock
- Stale lock cleanup: locks older than 30s are removed (prevents orphaned locks from browser crashes)
- Optional but recommended: Server-side lock validation in DO (prevent lock bypassing)

**Documentation Requirement**:
- Must update ARCHITECTURE.md with complete conflict resolution strategy
- Document all scenarios from rubric: simultaneous move, rapid edit storm, delete vs edit, create collision
- Explain how locks prevent conflicts vs how Yjs CRDT handles concurrent writes

**Testing Scenarios** (from rubric, must manually test):
1. Simultaneous Move: Users A and B both try to drag same rectangle → A gets lock, B sees locked state
2. Rapid Edit Storm: A resizes, B changes color, C moves → locks prevent conflicts
3. Delete vs Edit: A deletes while B is editing → delete succeeds, B sees shape disappear
4. Create Collision: Two users create at same timestamp → both succeed with unique IDs (Yjs handles this)

**Acceptance Criteria**:
- [ ] Selecting shapes creates visible lock for other users
- [ ] Other users cannot select or transform locked shapes
- [ ] Locks show colored outline matching user's presence color
- [ ] Hover tooltip shows "{username} is editing"
- [ ] Locks automatically released on deselection
- [ ] Stale locks cleaned up after 30 seconds
- [ ] All rubric test scenarios pass
- [ ] Conflict resolution strategy documented in ARCHITECTURE.md
- [ ] No deadlocks or race conditions observed

---

### PR18 — Duplicate (Cmd+D)
**Goal**: Quick duplication of selected shapes with keyboard shortcut

**Why This Matters**: Common operation, Tier 1 feature worth 2 points.

**Requirements**:
- Keyboard shortcut Cmd+D/Ctrl+D duplicates selection
- Duplication logic: clone shape properties, generate new IDs, offset position for visibility
- Offset strategy: (20px, 20px) from originals
- Works with multi-select: duplicates all selected shapes maintaining relative layout
- Newly duplicated shapes become selected (replacing previous selection)
- AI integration: AI can duplicate shapes via command
- Undoable via undo/redo system

**Edge Cases**:
- Duplicate of text: should copy content exactly
- Duplicate of locked shape: should succeed (duplication is local operation)
- Duplicate near canvas edge: ensure duplicates stay within reasonable bounds
- Multiple duplicates rapidly: ensure IDs don't collide

**Acceptance Criteria**:
- [ ] Cmd+D duplicates selected shapes with (20, 20) offset
- [ ] Works with single and multiple selection
- [ ] Duplicates are immediately selected
- [ ] Operation is undoable
- [ ] AI commands can trigger duplication
- [ ] Duplicates sync to all users immediately

---

## PHASE 4: Tier 1 Advanced Features (6-12 points)

### PR19 — Undo/Redo with Yjs History
**Goal**: Implement undo/redo using Yjs UndoManager for local-only history

**Why This Matters**: Tier 1 feature worth 2 points. Expected in any design tool. Must work across all operations.

**Requirements**:
- Use Yjs UndoManager to track changes to shapes Y.Map
- Track only local user's changes (not undo other users' edits)
- Group rapid changes with sensible timeout (avoid too-granular history)
- Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)
- Toolbar buttons showing enabled/disabled state based on undo/redo stack
- Works with all operations: create, move, resize, rotate, delete, style changes, AI actions
- Persist across page refresh (Yjs handles this automatically)

**Design Considerations**:
- Granularity: Should each drag movement be undoable or just final position?
- AI actions: Should complex commands ("create login form") undo as batch or individual shapes?
- Multi-user: If User A creates shape, User B deletes it, can User A undo the delete? (No - only own changes)
- Stack limits: Should undo history have a max depth to prevent memory issues?

**Integration Points**:
- Must work seamlessly with all existing operations
- AI-created shapes must be undoable
- Duplicate/copy-paste must work with undo
- Text editing should be undoable

**Acceptance Criteria**:
- [ ] Cmd+Z undoes last local operation (shape creation, movement, styling, deletion)
- [ ] Cmd+Shift+Z redoes previously undone operation
- [ ] Only local user's changes are undoable (cannot undo other users' actions)
- [ ] Toolbar buttons show correct enabled/disabled state
- [ ] AI-created shapes are undoable
- [ ] Undo works across page refresh (history persists)
- [ ] Undo of text edits works correctly
- [ ] Multi-step AI commands undo appropriately

---

### PR20 — Comprehensive Keyboard Shortcuts System
**Goal**: Implement full keyboard shortcut coverage with discoverability

**Why This Matters**: Tier 1 feature worth 2 points. Essential for power users. Distinguishes polished from basic tools.

**Requirements**:
- Centralized keyboard event handling (single source of truth)
- Tool switching: V (Select), R (Rectangle), C (Circle), T (Text)
- Navigation: Arrow keys move selected 10px, Shift+Arrow moves 1px (precise positioning)
- Selection: Cmd+A (select all), Escape (deselect)
- Editing: Delete/Backspace (remove), Cmd+D (duplicate), Cmd+C/V (copy/paste), Cmd+Z/Shift+Z (undo/redo)
- AI: / (slash) focuses AI input
- Help: ? opens shortcuts reference panel
- Input context awareness: disable shortcuts when typing in text fields
- Visual hints: show shortcuts in tooltips throughout UI
- Help panel: modal with categorized shortcut reference

**Discoverability Strategy**:
- Shortcuts shown in tooltips next to toolbar buttons
- Help panel accessible from toolbar (? icon) and keyboard (? key)
- Organized by category: Tools, Selection, Navigation, Editing, AI
- Consider progressive disclosure: show common shortcuts first

**Acceptance Criteria**:
- [ ] All 15+ keyboard shortcuts work correctly
- [ ] Tool switching shortcuts (V/R/C/T) change active tool
- [ ] Arrow keys move selection with pixel precision
- [ ] Cmd+A selects all, Escape deselects
- [ ] / key focuses AI input field
- [ ] ? key opens help panel
- [ ] Shortcuts disabled when typing in text inputs
- [ ] All shortcuts shown in tooltips
- [ ] Help panel accessible and comprehensive
- [ ] No conflicts between shortcuts

---

### PR21 — Color Picker & Copy/Paste
**Goal**: Complete essential styling and clipboard operations

**Why Combined**: Both are smaller Tier 1 features (2 points each) that enhance shape manipulation. Combining accelerates delivery without overwhelming scope.

**Why This Matters**: Tier 1 features worth 4 points total. Essential UX expectations for any design tool.

**Requirements**:

**Color Picker**:
- Component with standard palette (minimum 16 colors)
- Custom color selection (hex input or HSL/HSV picker)
- Recent colors (last 8, persisted in localStorage)
- Toolbar integration showing current fill color
- Apply to single or multiple selected shapes
- Import `THROTTLE.COLOR_CHANGE_MS` from constants for sync throttling
- Works with AI (AI can set colors via commands)
- Multi-selection: show "mixed" if shapes have different colors

**Copy/Paste**:
- Keyboard shortcuts: Cmd+C (copy), Cmd+V (paste)
- Copy serializes selected shapes to JSON
- Store in React context/component state (local per user, not shared)
- Paste deserializes, generates new IDs, offsets by (20, 20)
- Pasted shapes become selected
- Works with multi-select maintaining relative layout
- Visual feedback: "Copied 3 shapes", "Pasted 3 shapes"

**Edge Cases**:
- Copy/paste with nothing selected: no-op
- Multiple pastes: cumulative offset (20, 40, 60...)
- Copy locked shapes: works (lock not copied)
- Paste near edge: ensure shapes stay within reasonable bounds

**Acceptance Criteria**:
- [ ] Color picker accessible from toolbar with palette and custom input
- [ ] Recent colors persist in localStorage
- [ ] Color changes apply to all selected shapes and sync immediately
- [ ] Uses throttle constant for color change sync
- [ ] Multi-selection shows "mixed" indicator if colors differ
- [ ] Cmd+C copies selected shapes with visual confirmation
- [ ] Cmd+V pastes with (20, 20) offset
- [ ] Works with single and multi-select
- [ ] Relative positioning maintained for multi-shape paste
- [ ] Both operations are undoable
- [ ] AI commands can set colors
- [ ] Clipboard persists during session

---

## PHASE 5: Polish & Documentation (5 points)

### PR22 — Documentation Excellence
**Goal**: Create submission-ready documentation that showcases the project

**Why Critical**: Worth 5 points. Evaluators need to understand architecture and be able to run the project. Poor docs can cost points across multiple rubric sections.

**README.md Requirements**:
- Hero section with compelling visual (screenshot of real-time collaboration or GIF showing AI in action)
- Live demo link prominently placed at top (ensure it works!)
- Feature showcase with visual checkmarks for completed features
- Quick start guide (maximum 5 steps, tested to ensure it works)
- Tech stack section with badges and brief explanations
- Architecture overview linking to ARCHITECTURE.md with diagram
- Troubleshooting section addressing common setup issues
- Links to demo video and AI development log

**ARCHITECTURE.md Updates**:
- Add post-MVP features: AI Canvas Agent flow, additional shape types, object locking
- Comprehensive conflict resolution documentation (required by rubric - must explain strategy)
- AI command execution flow diagram (how request flows from client → worker → AI → DO → clients)
- Multi-select and locking implementation details
- Undo/redo architecture with Yjs UndoManager
- Performance characteristics and optimizations applied
- Update bundle sizes and deployment notes

**Documentation Quality Standards**:
- Clear, scannable formatting with headers and lists
- No broken links or outdated information
- Screenshots/diagrams that actually reflect current state
- Code examples (if any) must be accurate and tested
- Consistent terminology throughout

**Acceptance Criteria**:
- [ ] README is professional and easy to follow
- [ ] Quick start guide works from fresh clone (tested)
- [ ] Live demo link is prominently displayed and functional
- [ ] Visual content (screenshots/GIFs) shows key features
- [ ] ARCHITECTURE.md covers all implemented features
- [ ] Conflict resolution strategy fully documented
- [ ] AI command flow diagram included
- [ ] Links to demo video and AI dev log (prepare placeholders)

---

### PR23 — Performance Validation & Optimization
**Goal**: Verify app meets rubric performance targets and optimize if needed

**Why Critical**: Rubric Section 2 "Performance & Scalability" worth 12 points. Must demonstrate 500+ objects at 60 FPS and 5+ concurrent users.

**Performance Testing Protocol**:
- **Object Scale Test**: Create 500+ shapes (use AI: "Create a 25x25 grid of circles" = 625 shapes)
  - Measure FPS during pan/zoom using browser DevTools Performance tab
  - Test drag operations with many shapes
  - Monitor memory usage and check for leaks
- **Concurrent User Test**: 5+ users simultaneously
  - Open 5 browser tabs or invite actual users
  - Simultaneous editing, transform operations, AI usage
  - Monitor Yjs message rate and WebSocket traffic
  - Check for sync delays or dropped updates
- **Network Resilience Test**: Simulate poor connectivity
  - Use DevTools throttling (Slow 3G)
  - Disconnect/reconnect network
  - Verify no data loss, smooth reconnection
- **AI Performance Test**: Measure AI response times
  - Simple commands: should be <2s
  - Complex commands: should be <5s
  - Concurrent AI usage: multiple users' commands shouldn't interfere

**Optimization Strategies** (apply if targets not met):
- Viewport culling: only render shapes within visible area plus buffer
- Konva optimizations: disable hit detection for off-screen shapes, use layer caching
- Throttling tuning: adjust update frequencies if message rate too high
- AI history pagination: limit loaded history if >50 entries

**Acceptance Criteria**:
- [ ] Maintains 60 FPS with 500+ shapes during pan/zoom/drag
- [ ] 5+ concurrent users without sync delays or degradation
- [ ] Network disconnect/reconnect works without data loss
- [ ] AI response times meet targets (<2s simple, <5s complex)
- [ ] No memory leaks after extended use
- [ ] Performance test results documented in ARCHITECTURE.md

---

### PR24 — Comprehensive Testing & Production Readiness
**Goal**: Final validation of all features and fix any remaining issues before submission

**Why This Matters**: Last chance to catch bugs before submission. A single critical bug can cost multiple points.

**Comprehensive Test Matrix**:
- **AI Agent** (25 points at stake):
  - All 8+ command types work reliably
  - Complex commands create proper layouts
  - AI history shows for all users
  - Concurrent AI usage works
  - Guest users see history but can't send commands
- **Collaboration** (30 points at stake):
  - Real-time sync works smoothly
  - All 4 conflict resolution scenarios pass (from rubric)
  - Object locking prevents conflicts
  - Persistence across refresh/disconnect
- **Canvas Features** (20 points at stake):
  - All 3 shape types work fully
  - Transforms sync in real-time
  - Multi-select and lasso work correctly
- **Advanced Features** (15 points at stake):
  - Undo/redo works for all operations
  - All keyboard shortcuts functional
  - Color picker syncs colors
  - Copy/paste maintains layout
- **Cross-Browser Testing**:
  - Chrome (primary), Firefox, Safari
  - Mobile/tablet view (optional but check basic functionality)
- **Role Testing**:
  - Editor: full access
  - Guest/Viewer: read-only, sees AI history, cannot edit

**Bug Fixing Process**:
- Document all bugs found with reproduction steps
- Prioritize: critical (breaks functionality) → major (impacts UX) → minor (cosmetic)
- Fix critical and major bugs before submission
- Regression test after each fix
- Code quality: run linter, fix TypeScript errors, ensure tests pass

**Production Checklist**:
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` passes all tests
- [ ] Linter clean (biome check/format)
- [ ] No console errors in production build
- [ ] Environment variables documented
- [ ] Deployment successful and stable

**Acceptance Criteria**:
- [ ] All rubric test scenarios pass
- [ ] No critical or major bugs remaining
- [ ] Cross-browser compatibility verified
- [ ] Guest and editor roles work correctly
- [ ] All automated tests pass
- [ ] Linter and type checker clean
- [ ] App deployed and accessible
- [ ] Performance validated under load

---

## STRETCH GOALS (Excellent - 90-100+ points)

### PR25 — AI Agent Cursor Presence
**Goal**: Make AI agent visible as a cursor on canvas showing what it's working on

**Why Fun**: Humanizes the AI agent, provides visual feedback during command execution, delightful UX detail that could impress evaluators.

**Requirements**:
- AI agent appears in Awareness as special user (distinct color, robot icon)
- When executing command, AI cursor moves to affected shape locations
- Smooth animation between shapes during multi-step operations
- Optional: "working" indicator or typing animation near cursor
- Cursor disappears when AI is idle

**Technical Approach**:
- Use existing presence/cursor system (Yjs Awareness)
- Backend updates AI cursor position as it executes tool calls
- Frontend renders AI cursor like other users' cursors

**Acceptance Criteria**:
- [ ] AI cursor appears when AI is executing commands
- [ ] Cursor smoothly moves to shapes being created/modified
- [ ] All users see AI cursor simultaneously
- [ ] Doesn't interfere with normal cursor rendering or interactions
- [ ] AI cursor distinguishable from real users (icon, color, label)

---

### PR26 — Z-Index & Alignment Tools (Tier 2 - 6 points)
**Goal**: Professional layout tools for layer management and shape alignment

**Why Worth It**: Worth 6 points total (3 points each for two Tier 2 features). Essential for any serious design tool.

**Z-Index Management**:
- Add z-index property to shapes (rendering order)
- Toolbar controls: Bring to Front (Cmd+]), Send to Back (Cmd+[), Bring Forward, Send Backward
- Update Konva rendering to respect z-index order
- AI integration: AI can set z-index

**Alignment Tools**:
- Horizontal alignment: left, center, right
- Vertical alignment: top, middle, bottom
- Distribution: evenly space shapes horizontally or vertically
- Works on multi-select: align/distribute relative to bounding box
- AI integration: "align these shapes to the left"

**Acceptance Criteria**:
- [ ] Z-index controls reorder shapes visually
- [ ] Alignment tools work on 2+ selected shapes
- [ ] Distribution creates even spacing
- [ ] All operations sync to users
- [ ] AI can trigger alignment operations

---

### PR27 — Layers Panel (Tier 2 - 3 points)
**Goal**: Sidebar showing shape hierarchy with management controls

**Why Valuable**: Tier 2 feature worth 3 points. Critical for managing complex canvases.

**Requirements**:
- Sidebar panel listing all shapes (collapsible)
- Each entry shows: shape type icon, name/ID, thumbnail (optional)
- Click entry to select shape on canvas
- Drag to reorder (updates z-index)
- Visibility toggle per shape (eye icon)
- Lock toggle per shape (prevents editing)
- Optional: rename shapes
- Sync visibility and lock state via Yjs

**Acceptance Criteria**:
- [ ] Panel shows all shapes in order
- [ ] Click selects shape on canvas
- [ ] Drag reorders shapes (z-index updates)
- [ ] Visibility toggle shows/hides shapes
- [ ] Lock toggle prevents shape editing
- [ ] Changes sync to all users

---

### PR28-30 — Additional Tier 1 Features (2 points each)
**Goal**: Implement 3 more Tier 1 features for extra points

**PR28 - Export (2 points)**:
- Export canvas or selected shapes to PNG/SVG
- Export button in toolbar with options modal
- Configurable resolution/scale
- Uses Konva export APIs

**PR29 - Snap-to-Grid & Smart Guides (2 points)**:
- Toggle snap-to-grid in toolbar (configurable grid size)
- Smart guides: show alignment lines when dragging (Figma-style)
- Snap behavior during drag operations
- Optional: show distance measurements

**PR30 - Grouping (2 points)**:
- Cmd+G to group selected shapes
- Grouped shapes move/transform together
- Cmd+Shift+G to ungroup
- Groups can be nested
- Visual indication of group membership
- AI can create groups

**Acceptance Criteria** (all three):
- [ ] Export produces valid PNG/SVG files
- [ ] Snap-to-grid helps precise positioning
- [ ] Smart guides appear during drag
- [ ] Grouping works with multi-select
- [ ] All features sync across users

---

### PR31 — UI Polish & Animations (Bonus +2 points)
**Goal**: Exceptional UX with smooth animations and professional design

**Why It Matters**: Worth 2 bonus points under "Polish" category. Distinguishes excellent from good implementations.

**Animation Requirements**:
- Smooth UI transitions (panels, modals, tooltips)
- Shape creation animations (fade in, scale up)
- Cursor movement interpolation (smooth not jumpy)
- Button/hover micro-interactions
- Loading states with elegant animations

**Design System**:
- Consistent color palette and typography
- Professional design tokens
- Icon set with consistent style
- Optional: dark mode support

**Performance Constraint**:
- Animations must not impact FPS
- Use CSS transforms and requestAnimationFrame
- Avoid layout thrashing

**Acceptance Criteria**:
- [ ] All UI transitions are smooth and professional
- [ ] Animations feel delightful, not distracting
- [ ] Consistent visual design throughout
- [ ] No performance regression from animations
- [ ] App feels polished and production-ready

---

### PR32 — Extreme Performance (Bonus +1 point)
**Goal**: Achieve 1000+ objects at 60 FPS for performance bonus

**Why Challenging**: Default Konva rendering won't handle this. Requires advanced optimizations.

**Optimization Strategies**:
- Spatial indexing (quadtree/R-tree) for viewport culling
- Only render shapes in visible area plus buffer
- Konva layer caching and shape caching
- Disable hit detection for off-screen shapes
- Consider WebGL renderer for extreme scale
- Efficient Yjs update batching

**Testing**:
- Use AI to create grid: "Create a 50x50 grid of circles" (2500 shapes)
- Measure FPS during pan/zoom
- Verify no memory leaks
- Document optimizations

**Acceptance Criteria**:
- [ ] Maintains 60 FPS with 1000+ shapes
- [ ] Pan and zoom remain smooth
- [ ] No memory leaks after extended use
- [ ] Optimizations documented in ARCHITECTURE.md

---

### PR33 — Final Submission Deliverables (Required - Pass/Fail)
**Goal**: Complete required documentation for submission

**AI Development Log** (1 page, need 3/5 sections):
1. Tools & Workflow used
2. 3-5 effective prompting strategies with examples
3. Code analysis (% AI vs hand-written)
4. Strengths & limitations observed
5. Key learnings about AI-assisted development

**Demo Video** (3-5 minutes, REQUIRED):
- Show 2 browser windows collaborating side-by-side
- Demonstrate cursor presence and selection locking
- Execute multiple AI commands (simple and complex)
- Show advanced features working
- Explain architecture briefly
- Clear audio, 1080p resolution
- Upload to YouTube/Loom, link in README

**Submission Checklist**:
- [ ] AI Development Log complete (minimum 3 sections)
- [ ] Demo video recorded showing all requirements
- [ ] Video uploaded and linked in README
- [ ] GitHub repo public with all code
- [ ] README has live demo link
- [ ] App deployed and accessible
- [ ] All documentation accurate and current

**IMPORTANT**: Missing or poor-quality demo video = -10 points penalty

---

## Summary

### Required PRs (Good - 80-89 points): PR10-24
- **Phase 1 (AI)**: PR10-13 (4 PRs)
- **Phase 2 (Shapes)**: PR14-15 (2 PRs - combined circle+text, transform sync)
- **Phase 3 (Selection)**: PR16-18 (3 PRs - combined multi-select+lasso, locking, duplicate)
- **Phase 4 (Tier 1)**: PR19-21 (3 PRs - undo/redo, shortcuts, combined color+copy/paste)
- **Phase 5 (Polish)**: PR22-24 (3 PRs)

**Total Required**: 15 PRs

### Stretch PRs (Excellent - 90-100+ points): PR25-33
- **AI Cursor**: PR25 (1 PR)
- **Tier 2 Features**: PR26-27 (2 PRs)
- **Tier 1 Stretch**: PR28-30 (3 PRs - export, snap-to-grid, grouping)
- **Polish Bonus**: PR31 (1 PR)
- **Performance Bonus**: PR32 (1 PR)
- **Documentation**: PR33 (1 PR - required)

**Total Stretch**: 9 PRs

### Estimated Timeline
- **Days 1-2**: PR10-13 (AI Agent with RPC)
- **Day 2-3**: PR14-15 (Shapes: circle+text combined, transform sync)
- **Day 3**: PR16-18 (Selection: multi-select+lasso combined, locking, duplicate)
- **Day 3-4**: PR19-21 (Undo/redo, shortcuts, color+copy/paste combined)
- **Day 4**: PR22-24 (Docs, performance, final testing)
- **Stretch**: PR25-33 (if time permits)

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Ready for Execution 🚀

