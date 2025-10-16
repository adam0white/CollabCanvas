# CollabCanvas Post-MVP PRD
## Building Toward Production-Ready Collaborative Design Tool

**Timeline**: 3.5 days  
**Target Grade**: Good (80-89) → Excellent (90-100+) stretch  
**Current Status**: MVP complete (real-time sync, basic shapes, auth, deployment)  
**Platform**: Cloudflare Developer Platform (Workers, Durable Objects, Workers AI)

---

## Executive Summary

This PRD outlines the path from MVP to a feature-complete CollabCanvas that meets all rubric requirements. The AI Canvas Agent (25 points) is the highest priority, followed by expanding canvas features and adding Tier 1 advanced features. All new features must integrate seamlessly with the AI Agent and real-time collaboration infrastructure.

**Critical Principle**: Keep the app in a working, deployable state after every change. Each phase must maintain or enhance existing functionality.

### Current MVP Score Estimate: ~45-50/100
- Core Collaborative Infrastructure: 20/30 (missing conflict resolution)
- Canvas Features & Performance: 8/20 (1 shape, limited transforms)
- Advanced Features: 0/15 (none implemented)
- AI Canvas Agent: 0/25 (**critical gap**)
- Technical Implementation: 8/10 (solid architecture)
- Documentation: 2/5 (basic README, needs polish)

### Target Post-Implementation Score: 80-89 (Good) → 90+ (Excellent)

---

## Testing Strategy

**Philosophy**: Test continuously at every stage to maintain working state. Prefer manual testing for UI/UX, automated tests for business logic.

### Current Test Coverage
- ✅ 5 test files, 20 tests (worker routing, DO persistence, debounce logic, shape types)
- ✅ Vitest for backend unit tests
- ⚠️ No frontend tests yet
- ⚠️ No e2e tests

### Expansion Needed
1. **More Unit Tests**: Add tests for new shapes (circle, text), multi-select logic, undo/redo
2. **Integration Tests**: Test AI command execution end-to-end
3. **E2E Tests (Consider)**: Playwright or Cypress for critical flows (multi-user collaboration, AI commands)
4. **Manual Testing Checklist**: Document test scenarios for each phase (see Phase 3 for examples)

### Testing Per Phase
- After each phase, run full test suite: `npm test`
- Deploy to staging: `npm run deploy` (Cloudflare previews)
- Manual multi-browser testing: 2+ users simultaneously
- Performance check: Monitor FPS during interactions

---

## Goals & Success Metrics

### Primary Goals (Required for "Good" - 80-89 points)

**1. AI Canvas Agent (25 points)**
- ✅ 6+ distinct command types across all categories
- ✅ Sub-2 second response time
- ✅ 80%+ accuracy on command execution
- ✅ Shared state (all users see AI results)
- ✅ Natural UX with loading indicators

**2. Canvas Feature Completeness (12 additional points)**
- ✅ 3+ shape types (rectangle, circle, text)
- ✅ Full transform operations visible to all users
- ✅ Multi-select + lasso select
- ✅ Duplicate functionality

**3. Conflict Resolution & State Management (9 points)**
- ✅ Object locking on selection
- ✅ Clear visual feedback on edit conflicts
- ✅ Documented conflict resolution strategy

**4. Tier 1 Advanced Features (6 points minimum)**
- ✅ Undo/redo with Yjs history
- ✅ Keyboard shortcuts (comprehensive set)
- ✅ Color picker with recent colors
- ✅ Copy/paste functionality

**5. Documentation & Deployment (5 points)**
- ✅ Polished README with architecture
- ✅ AI Development Log (1 page)
- ✅ Demo video (3-5 min)
- ✅ Stable deployment supporting 5+ users

### Stretch Goals (Excellent - 90+ points)
- Additional Tier 1 features (object grouping, export PNG/SVG, snap-to-grid)
- Tier 2 features (layers panel, alignment tools, z-index management)
- Performance optimization (500+ objects at 60 FPS)
- Polish bonus (+2 points)

---

## Feature Requirements

## PHASE 1: AI Canvas Agent 🎯 PRIORITY

### Overview
Build an AI agent using **Cloudflare Workers AI** (with BYOK option or built-in models) that manipulates the canvas through natural language. All AI-generated changes must sync via Yjs to all connected users in real-time.

**Key Decisions**:
- **Backend AI**: Worker route handles all AI requests (secure, no exposed keys)
- **Workers AI**: Leverage Cloudflare's AI models (llama, mistral) or BYOK for OpenAI
- **No Rate Limiting**: Trust users, optimize for speed
- **Single Shared AI Agent**: One AI instance, all users see responses and history
- **Context Awareness**: AI understands user selections and relative references

### AI Access Control
- **Editors**: Can send AI commands and see history
- **Viewers/Guests**: Can see AI history and responses (read-only), cannot send commands
- **UI**: Input field visible to all, disabled for guests with tooltip "Sign in to use AI"

### AI History & Multi-User Behavior
- **Shared History**: All AI commands and responses visible to all users
- **User Context**: AI understands "these shapes", "the selected rectangle" based on user's selection
- **Concurrent Commands**: Multiple editors can use AI simultaneously, responses stream back independently
- **Persistence**: AI history stored in Yjs (Y.Array of command/response pairs)

### Stretch Goal: AI Cursor
- AI agent appears as a named cursor on canvas ("🤖 AI Assistant")
- Cursor moves to shapes as AI creates/manipulates them
- Visual feedback: shows what AI is "working on"

### Required Command Types (Minimum 6, Target 8-10)

#### Creation Commands (Need 2+)
1. **Create Rectangle**: "Create a red rectangle at 100, 200"
2. **Create Circle**: "Add a blue circle in the center"
3. **Create Text**: "Make a text layer that says 'Hello World'"
4. **Create with Dimensions**: "Make a 200x300 green rectangle"

#### Manipulation Commands (Need 2+)
5. **Move Shape**: "Move the blue rectangle to the center" (requires object selection logic)
6. **Resize Shape**: "Make the circle twice as big"
7. **Change Color**: "Change the red rectangle to purple"
8. **Rotate Shape**: "Rotate the text 45 degrees"

#### Layout Commands (Need 1+)
9. **Horizontal Layout**: "Arrange these shapes in a horizontal row"
10. **Grid Layout**: "Create a 3x3 grid of squares"
11. **Even Spacing**: "Space these elements evenly"

#### Complex Commands (Need 1+)
12. **Login Form**: "Create a login form with username and password fields" (3+ elements, properly arranged)
13. **Navigation Bar**: "Build a navigation bar with 4 menu items"
14. **Card Layout**: "Make a card with title, description, and button"

### Technical Architecture

**Implementation Approach**:
- Worker route: `POST /c/main/ai-command` (authenticated, verified via JWT)
- Worker calls Cloudflare Workers AI (or OpenAI via BYOK)
- AI response includes function calls (tool invocations)
- Worker executes functions by manipulating Yjs document on Durable Object
- Changes broadcast to all clients via normal Yjs sync flow
- Response streamed back to requesting client

**AI Tools Needed** (8-10 functions):
- Shape creation (rectangle, circle, text)
- Shape manipulation (move, resize, rotate, delete)
- Style updates (color, stroke)
- Layout operations (arrange, align, distribute)
- Canvas queries (get state, find shapes by criteria)

**Context Management**:
- AI receives current canvas state (all shapes)
- AI receives user's selected shapes (for "these" references)
- AI receives user's viewport center (for "here" or "center" references)
- AI maintains short-term conversation context per user

### AI UX Requirements
- **Input**: Text input field (always visible or keyboard shortcut `/` to focus)
- **History Panel**: Show previous commands and responses (scrollable, persistent)
- **Loading State**: "AI is thinking..." indicator with animated dots
- **Feedback**: Visual feedback showing shapes being created/modified
- **Error Handling**: Clear inline error messages ("I couldn't find a blue rectangle")
- **Undo**: All AI actions should be undoable via undo/redo system
- **Attribution**: AI-created shapes marked with metadata (createdBy: "ai-assistant")

#### Performance Targets
- Response time: <2s for single-step commands
- Response time: <5s for complex multi-step commands
- Accuracy: 80%+ correct execution on test prompts
- Concurrent users: Multiple users can use AI simultaneously without conflicts

### Acceptance Criteria
- [ ] 8+ command types working reliably
- [ ] Complex commands create 3+ properly arranged elements
- [ ] AI-generated shapes sync to all users in real-time
- [ ] Sub-2s response time for simple commands
- [ ] Natural UX with loading states and feedback
- [ ] AI history visible to all users (editors can send commands, guests see history only)
- [ ] Multiple editors can use AI simultaneously without conflicts

---

## PHASE 2: Enhanced Canvas Features

### 2.1 Additional Shape Types

#### Circle Shape
**Requirements**:
- Drag-to-create interaction: radius based on drag distance from center
- Resize with corner handles (maintains circular aspect ratio)
- Same transform capabilities as rectangle (move, rotate, delete)
- Supports fill color and optional stroke
- Syncs via Yjs like all shapes

#### Text Shape
**Requirements**:
- Click-to-create interaction, opens text input immediately
- Double-click existing text to edit content
- Simple text editing (no collaborative Y.Text needed unless it speeds us up - last-write-wins is acceptable)
- Font size adjustable via properties panel or resize handles
- Supports text alignment (left, center, right)
- Default font: Arial or system font
- Syncs text content + formatting via Yjs

**Note**: Keep text editing simple. No need for real-time collaborative text editing within the shape - standard Yjs shape sync is sufficient.

### 2.2 Real-Time Transform Sync

**Problem**: Currently, while dragging/resizing/rotating, temporary state isn't visible to other users until mouseup.

**Solution**: 
- Throttled transform updates during drag operations (50ms = 20 updates/sec)
- Apply throttling to drag, resize, and rotate events
- Visual indicator for shapes "currently being edited" (slightly transparent or colored outline)
- Ensure throttled updates work with selection locking (lock holder can update)

### 2.3 Multi-Select & Lasso Select

#### Multi-Select (Shift+Click)
- Click shape with Shift held → add/remove from selection array
- Multiple shapes show selection outlines
- Transformer applies to bounding box of all selected shapes
- Drag moves all selected shapes together (maintaining relative positions)
- Delete removes all selected shapes
- Copy/paste/duplicate work on entire selection

#### Lasso Select (Drag on Canvas)
- When Select tool active, drag on empty canvas → draw selection rectangle
- On release, select all shapes with centers inside rectangle
- Visual: dashed blue rectangle during drag
- Works seamlessly with multi-select (can Shift+lasso to add to selection)

#### Selection State Management
- Store selections in Yjs Awareness (per-user, ephemeral)
- Each user sees their own selection highlights
- Selection state includes: userId, shapeIds, timestamp
- Use for conflict resolution (see Phase 3)

### 2.4 Duplicate Functionality
- Keyboard shortcut: `Cmd+D` / `Ctrl+D`
- Duplicates selected shape(s)
- Offset by (20, 20) to make duplicate visible
- Generates new shape IDs
- Syncs via Yjs

---

## PHASE 3: Conflict Resolution & Object Locking

### 3.1 Selection-Based Locking

**Strategy**: Optimistic locking with visual feedback (documented as required by rubric)

#### Lock Mechanism
- Store locks in Yjs Awareness (per-user ephemeral state)
- Lock includes: shapeId, userId, userName, timestamp, lockType ('transform' or 'edit')
- Locks tied to selections: selecting a shape creates a lock
- Multiple shapes can be locked by same user (multi-select)

#### Lock Behavior
1. **On Selection**: User selects shape → lock automatically added to awareness
2. **Other Users See**: 
   - Shape has colored outline matching the lock holder's presence color
   - Hover tooltip: "🔒 {userName} is editing"
   - Cannot select or transform locked shape (interactions blocked)
3. **On Deselection**: Lock removed from awareness immediately
4. **Timeout**: Stale locks (30s+ inactive) automatically cleaned up

#### Conflict Resolution Rules (Must Be Documented in ARCHITECTURE.md)
- **Simultaneous Edits**: Last write wins (Yjs CRDT handles merging)
- **Lock Conflicts**: First to select gets lock; others see "locked" state
- **Transform Conflicts**: Throttled updates (50ms) reduce race conditions
- **Delete vs Edit**: Delete operation takes precedence; other user sees visual feedback
- **Create Collisions**: Multiple creates succeed with unique IDs (Yjs ensures uniqueness)

### 3.2 Visual Feedback
- Locked shapes: Colored border matching user's presence color
- Hover tooltip: "🔒 Locked by {userName}"
- Visual cue when attempting to select locked shape (outline flashes briefly)

### 3.3 Testing Scenarios (from rubric)
- [ ] Simultaneous Move: Two users drag same rectangle → first gets lock, second sees locked state
- [ ] Rapid Edit Storm: User A resizes, User B colors, User C moves → locks prevent conflicts
- [ ] Delete vs Edit: User A deletes while User B edits → delete succeeds, User B sees notification
- [ ] Create Collision: Two users create at same timestamp → both succeed with unique IDs

---

## PHASE 4: Tier 1 Advanced Features (Day 3-4)

### 4.1 Undo/Redo (Yjs History)

**Implementation**: Use `y-protocols` UndoManager

**Features**:
- Undo/Redo stack persists across sessions
- Keyboard shortcuts: `Cmd+Z` / `Cmd+Shift+Z`
- Button UI in toolbar with state (grayed out when stack empty)
- Only undoes local user's changes (not others')

### 4.2 Comprehensive Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Delete` / `Backspace` | Delete selected shape(s) | ✅ Already implemented |
| `Cmd+D` / `Ctrl+D` | Duplicate selected | New |
| `Cmd+C` / `Ctrl+C` | Copy selected | New |
| `Cmd+V` / `Ctrl+V` | Paste from clipboard | New |
| `Cmd+Z` / `Ctrl+Z` | Undo | New |
| `Cmd+Shift+Z` / `Ctrl+Shift+Z` | Redo | New |
| `Arrow Keys` | Move selected 10px | New |
| `Shift+Arrow` | Move selected 1px | New |
| `Cmd+A` / `Ctrl+A` | Select all | New |
| `Escape` | Deselect all | New |
| `R` | Rectangle tool | New |
| `C` | Circle tool | New |
| `T` | Text tool | New |
| `V` | Select tool | New |
| `/` | Open AI command input | New |

**Implementation**:
- Global keyboard listener in `App.tsx`
- Check if input/textarea focused (skip shortcuts)
- Show keyboard shortcuts panel (`?` key and maybe a button in the toolbar)

### 4.3 Color Picker with Recent Colors

**UI Component**: Dropdown color picker (can use `react-colorful` or build custom)

**Features**:
- Standard color palette (16 common colors)
- Custom color picker (HSL sliders)
- Recent colors (last 8 used, stored in localStorage)
- Live preview when hovering over colors

**Integration**:
- Toolbar button: color swatch showing current color
- Applies to selected shape(s)
- Updates shape's `fill` property via Yjs
- Works with AI (AI can set colors)

### 4.4 Copy/Paste Functionality

**Copy** (`Cmd+C`):
- Serialize selected shape(s) to JSON
- Store in clipboard state (React context or localStorage)
- Visual feedback: Toast "Copied 1 shape"

**Paste** (`Cmd+V`):
- Deserialize from clipboard
- Generate new IDs
- Offset by (20, 20) from original
- Insert into Yjs shapes map
- Select pasted shapes

**Cross-User Paste**: No (clipboard is local to each user)

---

## PHASE 5: Polish & Documentation (Day 4)

### 5.1 README Enhancements
- [ ] Hero section with screenshot/GIF
- [ ] Live demo link prominently displayed
- [ ] Feature list with checkboxes
- [ ] Setup instructions (5 steps max)
- [ ] Architecture diagram (from ARCHITECTURE.md)
- [ ] Troubleshooting section
- [ ] Tech stack badges
- [ ] "How it works" section (Yjs, CRDT, Durable Objects)

### 5.2 AI Development Log (1 page)
**Note**: This is a living document; continuously update as development progresses.

**Required** (must include ANY 3 of 5 sections):
- [ ] Tools & Workflow: What AI tools used and how integrated them
- [ ] Prompting Strategies: 3-5 effective prompts with explanations
- [ ] Code Analysis: Rough % AI-generated vs hand-written
- [ ] Strengths & Limitations: Where AI excelled vs where it struggled
- [ ] Key Learnings: Insights about working with AI coding agents

### 5.3 Demo Video Requirements
**Requirements** (3-5 minutes, pass/fail):
- Real-time collaboration with 2+ users (show both screens)
- Multiple AI commands executing
- Advanced features walkthrough
- Architecture explanation
- Clear audio and video quality

**Key Points to Demonstrate**:
- Simultaneous editing with cursor presence
- Selection locking visual feedback
- AI creating simple and complex layouts
- Undo/redo, multi-select, keyboard shortcuts
- Performance at scale (pan/zoom with many objects)

### 5.4 Performance Validation
- [ ] Test with 500+ objects (create grid via AI: "Create a 25x25 grid of circles")
- [ ] Confirm 60 FPS during pan/zoom
- [ ] Test with 5 concurrent users (friends or browser tabs)
- [ ] Network throttling test (slow 3G → reconnects smoothly)

---

## Technical Considerations

### AI Agent Integration Points

**All new features must be AI-controllable**:
- Create shapes (rectangle, circle, text)
- Move, resize, rotate shapes
- Change colors and styles
- Delete shapes
- Arrange shapes in layouts
- Query canvas state

**AI Context Awareness**:
- AI receives current canvas state (all shapes with properties)
- AI understands relative positioning: "center", "top-left", "below the red rectangle"
- AI can select shapes by criteria: "the blue rectangle" → match by color + type
- AI uses smart defaults: "create a circle" → reasonable size, appropriate position

### Yjs Schema Considerations

**Shape Properties to Add**:
- New types: 'circle', 'text' (in addition to 'rectangle')
- Circle-specific: radius
- Text-specific: text content, fontSize, fontFamily, alignment
- Styling: stroke, strokeWidth, opacity (optional)
- Metadata: createdBy (userId or "ai-assistant"), createdAt, updatedAt timestamps

**Backward Compatibility**:
- Existing rectangle shapes continue to work
- New properties optional (use defaults if missing)
- Type guards ensure safe property access

### Security Considerations

**AI Command Validation**:
- Input sanitization: Strip HTML, limit prompt length (1000 chars)
- Output validation: Ensure AI doesn't create excessive shapes in one command (reasonable max: 50-100)
- Cost control: Set max_tokens for AI responses (prevent runaway costs)
- JWT verification: Only authenticated editors can send AI commands

**Object Locking**:
- Locks expire after 30s to prevent stale locks
- Validation: Check lock ownership before applying transform updates
- Lock cleanup on disconnect (via Yjs Awareness cleanup)

**Rate Limiting**: Not implemented - trust users, prioritize speed and UX

### Performance Optimizations

**Throttling Strategy**:
| Event | Throttle | Max Rate |
|-------|----------|----------|
| Cursor movement | 50ms | 20/s |
| Shape drag | 50ms | 20/s |
| Shape transform | 50ms | 20/s |
| Color picker change | 100ms | 10/s |

**Konva Optimizations**:
- Use `listening: false` for background layers (grid)
- Batch shape updates in animation frames
- Use `Konva.Layer.batchDraw()` instead of `draw()` during rapid updates
- Implement viewport culling for 500+ objects (only render visible shapes)

---

## Success Metrics (Rubric Mapping)

### Core Collaborative Infrastructure (30 points)
- **Real-Time Sync (12 pts)**: Target 11-12 (excellent) ✅ Already solid from MVP
- **Conflict Resolution (9 pts)**: Target 8-9 (excellent) ← **PHASE 3**
- **Persistence (9 pts)**: Target 8-9 (excellent) ✅ Already solid from MVP

### Canvas Features & Performance (20 points)
- **Canvas Functionality (8 pts)**: Target 7-8 (excellent) ← **PHASE 2**
- **Performance (12 pts)**: Target 11-12 (excellent) ✅ Optimize in PHASE 5

### Advanced Features (15 points)
- **Target**: 10-12 (good) = 2-3 Tier 1 + 1-2 Tier 2 ← **PHASE 4**
- **Tier 1 (6 pts)**: Undo/redo, keyboard shortcuts, color picker (3 features × 2pts)
- **Tier 2 (6 pts)**: Selection tools, multi-select (2 features × 3pts)

### AI Canvas Agent (25 points)
- **Command Breadth (10 pts)**: Target 9-10 (excellent) ← **PHASE 1**
- **Complex Commands (8 pts)**: Target 7-8 (excellent) ← **PHASE 1**
- **Performance & Reliability (7 pts)**: Target 6-7 (excellent) ← **PHASE 1**

### Technical Implementation (10 points)
- **Architecture (5 pts)**: Target 5 (excellent) ✅ Already solid from MVP
- **Authentication (5 pts)**: Target 5 (excellent) ✅ Already solid from MVP

### Documentation (5 points)
- **Repository (3 pts)**: Target 3 (excellent) ← **PHASE 5**
- **Deployment (2 pts)**: Target 2 (excellent) ✅ Already deployed

### Demo Video + AI Log (Pass/Fail)
- **AI Log**: PASS ← In progress
- **Demo Video**: PASS ← **PHASE 5**

### **Projected Total: 85-95 points (Good → Excellent)**

---

## Out of Scope (Stretch Goals for After Deadline)

**Tier 2 Features** (if time permits):
- Layers panel with drag-to-reorder
- Alignment tools (align left/center/right, distribute evenly)
- Z-index management (bring to front, send to back)
- Styles/design tokens system

**Tier 3 Features** (future iterations):
- Auto-layout (flexbox-like spacing)
- Collaborative comments on objects
- Version history with restore
- Vector path editing (pen tool)

**Performance Bonuses**:
- 1000+ objects at 60 FPS (+1 point)
- 10+ concurrent users (+1 point)

**Polish Bonuses**:
- Exceptional UI/UX (+2 points)
- Smooth animations and transitions
- Professional design system

---

## Risk Mitigation

### High-Risk Items
1. **AI Agent Reliability**: 
   - Risk: Workers AI models may be less capable than GPT-4
   - Mitigation: Test both Workers AI and BYOK OpenAI options; implement fallbacks; extensive prompt testing
   
2. **Object Locking Complexity**:
   - Risk: Race conditions in distributed lock system
   - Mitigation: Use Yjs Awareness (built-in), keep logic simple, test thoroughly with concurrent users
   
3. **Time Constraints**:
   - Risk: Not enough time for all features
   - Mitigation: Prioritize ruthlessly; maintain working state after each PR; cut Tier 2 features if needed

### Medium-Risk Items
1. **Performance with 500+ Objects**:
   - Risk: FPS drops with complex scenes
   - Mitigation: Implement viewport culling early; profile performance continuously; use Konva optimizations

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Ready for Implementation 🚀

