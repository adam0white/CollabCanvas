# CollabCanvas E2E Test Plan

## Overview

Comprehensive Playwright E2E test suite covering critical user flows and collaborative features for CollabCanvas Phase 2.5.

**Goal**: Minimize manual testing by covering 70-80% of critical flows with automated tests.

## Test Categories

### 1. Authentication & Authorization
- ✅ **Feasible**
  - Sign in flow with Clerk
  - Editor role permissions (can create/edit shapes)
  - Guest/viewer role (read-only, sees shapes but cannot edit)
  - JWT token verification
  - AI command access (editors only)

### 2. Shape Creation & Editing
- ✅ **Feasible**
  - Rectangle creation (click+drag)
  - Circle creation
  - Text shape creation and editing
  - Shape movement (drag)
  - Shape resize with handles
  - Shape rotation
  - Shape deletion (Delete key)
  - Shape property editing (fill, stroke, dimensions)

### 3. Real-Time Collaboration
- ✅ **Feasible**
  - Multi-user shape sync (create shape in one browser, appears in another)
  - Real-time cursor presence
  - Transform sync (drag/resize/rotate visible to others)
  - Persistence (shapes survive page refresh)
  - WebSocket reconnection handling
- ❌ **Unfeasible**
  - Exact sub-100ms lag measurements (timing races)
  - Precise FPS validation (use manual DevTools instead)

### 4. AI Canvas Agent - Basic Tools
- ✅ **Feasible**
  - `createShape`: Create rectangle/circle/text via AI command
  - `moveShape`: Move shape by ID
  - `getCanvasState`: Retrieve canvas state
  - Color normalization (e.g., "red" → "#FF0000")
  - AI command loading states and error handling

### 5. AI Canvas Agent - Advanced Tools
- ✅ **Feasible**
  - `resizeShape`: Resize by absolute dimensions or scale factor
  - `rotateShape`: Rotate shape by degrees
  - `updateShapeStyle`: Change fill/stroke/strokeWidth
  - `deleteShape`: Remove shape
  - `arrangeShapes`: Layout shapes (horizontal/vertical/grid)
  - `findShapes`: Pattern matching by type/color/text

### 6. AI History & Collaboration
- ✅ **Feasible**
  - AI history sync across users (all see same history)
  - Guest users see AI history but cannot send commands
  - History persistence across refresh
  - Concurrent AI commands from multiple users

### 7. Complex AI Commands
- ✅ **Feasible**
  - Multi-shape creation (e.g., "create a login form" → 3 shapes)
  - Spatial context ("create circle below the red rectangle")
  - Batch operations
  - Idempotency (duplicate commandId returns cached result)

### 8. Edge Cases & Error Handling
- ✅ **Feasible**
  - Empty canvas states
  - Invalid AI commands
  - Concurrent operations (two users editing same shape)
  - Network disconnection/reconnection
  - Shape operations on deleted shapes
  - AI command timeout handling

## Test Organization

```
web/tests/e2e/
├── auth.spec.ts              # Authentication and authorization
├── shapes.spec.ts             # Shape creation, editing, deletion
├── collaboration.spec.ts      # Multi-user sync, presence, transforms
├── ai-basic.spec.ts           # AI basic tools (create, move, getCanvasState)
├── ai-advanced.spec.ts        # AI advanced tools (resize, rotate, style, delete, arrange)
├── ai-history.spec.ts         # AI history sync and collaboration
├── ai-complex.spec.ts         # Complex multi-shape AI commands
└── edge-cases.spec.ts         # Error handling, empty states, concurrent ops
```

## Multi-User Testing Strategy

- Use multiple browser contexts in single test
- Example: `const user1 = await browser.newContext(); const user2 = await browser.newContext();`
- Verify state sync by creating in one context and checking in another
- Clean up: close contexts properly, delete created shapes

## Authentication Strategy

- Use Clerk development keys (from secrets)
- Use TEST_USER_EMAIL and password for login
- No mocking needed - real authentication flow
- Store session state for reuse across tests

## AI Testing Strategy

- Use real AI endpoint (prefer integration confidence over mocking)
- Don't worry about usage/budget
- Test both success and error paths
- Verify AI history entries appear in Yjs

## Quality Standards

1. **Test Isolation**: Each test should be independent
2. **Descriptive Names**: "should create circle when AI command executed"
3. **Modern Playwright**: Use `page.getByRole()`, `expect(locator).toBeVisible()`, avoid `waitForTimeout()`
4. **Parallel Safe**: Tests don't interfere with each other
5. **Clean Up**: Close contexts, delete shapes, avoid test pollution
6. **Failing Tests Are Good**: Document bugs, don't modify tests to pass

## Coverage Target

- **70-80% of critical flows** (not 100% - diminishing returns)
- Focus on high-value scenarios that catch real bugs
- Skip pixel-perfect rendering, exact timing measurements

## Expected Outcomes

- Comprehensive test suite that gives confidence
- Some failing tests expected (they surface real bugs!)
- Clear documentation of what's tested and what gaps remain
- Foundation for CI/CD integration

---

**Created**: 2025-10-17  
**Status**: Active Development
