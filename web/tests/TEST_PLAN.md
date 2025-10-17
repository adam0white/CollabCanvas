# CollabCanvas E2E Test Plan

## Overview
Comprehensive Playwright test suite covering critical user flows and collaborative features to minimize manual testing.

## Test Environment
- **Framework**: Playwright with TypeScript
- **Browsers**: Chromium, Firefox
- **Base URL**: http://localhost:8787 (dev server)
- **Auth**: Real Clerk development keys with TEST_USER_EMAIL credentials
- **AI Testing**: Real AI endpoint (integration confidence)

## Test Structure

### 1. Authentication & Authorization (`auth.spec.ts`)
**Priority**: Critical
**Coverage**: 15% of critical flows

- [ ] Guest (unauthenticated) user can view canvas
- [ ] Guest can see existing shapes but cannot edit
- [ ] Guest cannot create shapes (toolbar buttons disabled)
- [ ] Guest cannot use AI assistant (input disabled with tooltip)
- [ ] Guest can pan and zoom canvas
- [ ] Authenticated user can sign in with Clerk
- [ ] Authenticated user can create, edit, delete shapes
- [ ] Authenticated user can use AI assistant
- [ ] Session persistence across page refresh
- [ ] Editor vs guest role enforcement

### 2. Shape Creation & Editing (`shapes.spec.ts`)
**Priority**: Critical
**Coverage**: 25% of critical flows

#### Rectangle Operations
- [ ] Create rectangle with click-and-drag
- [ ] Rectangle shows live preview (dashed outline) during creation
- [ ] Small rectangles (<10px) are not created
- [ ] Rectangle appears for all users in real-time
- [ ] Drag rectangle to move (select tool)
- [ ] Resize rectangle with handles
- [ ] Rotate rectangle
- [ ] Delete rectangle with Delete/Backspace key
- [ ] Delete deselects shape

#### Circle Operations
- [ ] Create circle with click-and-drag from center
- [ ] Circle shows live preview during creation
- [ ] Small circles (<5px radius) are not created
- [ ] Circle syncs to all users
- [ ] Move, resize, rotate circle
- [ ] Delete circle

#### Text Operations
- [ ] Create text shape by clicking canvas
- [ ] Text input overlay appears at click position
- [ ] Enter text and submit with Enter key
- [ ] Cancel text creation with Escape
- [ ] Empty text is not created
- [ ] Text syncs to all users
- [ ] Double-click text to edit
- [ ] Update existing text content
- [ ] Delete text shape

#### Shape Properties
- [ ] All shapes have correct default fills
- [ ] Shapes persist across page refresh
- [ ] Shape selection shows visual feedback
- [ ] Deselect with Escape key
- [ ] Click empty canvas deselects shape

### 3. AI Canvas Agent (`ai-agent.spec.ts`)
**Priority**: High
**Coverage**: 20% of critical flows

#### Basic AI Tools
- [ ] "Create a red rectangle at 100, 200" - creates rectangle
- [ ] "Create a blue circle at 300, 300 with radius 50" - creates circle
- [ ] "Create a text that says 'Hello World'" - creates text
- [ ] AI command shows loading state ("AI is thinking...")
- [ ] Success shows shape created confirmation
- [ ] Error shows helpful error message

#### Advanced AI Tools
- [ ] "Move shape {id} to 500, 500" - moves shape
- [ ] "Resize the rectangle to 200x300" - resizes shape
- [ ] "Rotate the square 45 degrees" - rotates shape
- [ ] "Change the blue circle to green" - updates fill color
- [ ] Color normalization (red → #FF0000, blue → #0000FF, etc.)
- [ ] "Delete the red rectangle" - deletes shape
- [ ] "Arrange these shapes in a row" - horizontal layout

#### Complex AI Commands
- [ ] "Create a login form" - generates 3+ properly arranged elements
- [ ] "Build a navigation bar with 4 items" - horizontal text layout
- [ ] "Create a 3x3 grid of circles" - creates 9 circles in grid
- [ ] Complex commands complete within 5 seconds
- [ ] All shapes from single command created atomically (single Yjs update)

#### AI History & Collaboration
- [ ] AI history shows all commands
- [ ] History displays: user name, timestamp, prompt, response
- [ ] History shows shape count affected
- [ ] User A sends command → User B sees it in history within 200ms
- [ ] Two users send commands simultaneously → both appear in history
- [ ] History persists across page refresh
- [ ] Guest users see history but cannot send commands
- [ ] Current user's commands highlighted in history

#### AI Error Handling
- [ ] Invalid command shows error
- [ ] Shape not found shows helpful message
- [ ] Guest user sees disabled input with tooltip
- [ ] Command timeout (>10s) shows error
- [ ] Prompt too long (>1000 chars) rejected

### 4. Real-Time Collaboration (`collaboration.spec.ts`)
**Priority**: Critical
**Coverage**: 20% of critical flows

#### Cursor Presence
- [ ] User A moves mouse → User B sees cursor in real-time
- [ ] Cursor shows user name label
- [ ] Cursor has distinct color per user
- [ ] Multiple users' cursors visible simultaneously
- [ ] Off-screen cursors show edge indicators
- [ ] Cursor updates throttled to ~50ms
- [ ] Cursor disappears when user leaves canvas

#### Shape Sync
- [ ] User A creates shape → User B sees it instantly
- [ ] User A moves shape → User B sees smooth movement (not jumps)
- [ ] User A resizes shape → User B sees resize in real-time
- [ ] User A rotates shape → User B sees rotation
- [ ] User A deletes shape → User B sees deletion
- [ ] Real-time transform sync during drag (throttled updates)
- [ ] Final position always sent on mouseup

#### Multi-User Editing (2+ Browser Contexts)
- [ ] Two users create shapes simultaneously
- [ ] Two users move different shapes at same time
- [ ] Shape state remains consistent across all users
- [ ] No shape flicker or "snapping back"
- [ ] All users see same final state

#### Persistence & Reconnection
- [ ] Shapes persist after page refresh
- [ ] AI history persists after refresh
- [ ] Network disconnect → reconnect without data loss
- [ ] Offline changes buffered and synced on reconnect

### 5. Canvas Interactions (`canvas.spec.ts`)
**Priority**: Medium
**Coverage**: 10% of critical flows

#### Pan & Zoom
- [ ] Mouse wheel zooms in/out (toward pointer)
- [ ] Zoom clamped to MIN_ZOOM (0.1) and MAX_ZOOM (5)
- [ ] Zoom controls UI buttons work
- [ ] Reset zoom button returns to 100%
- [ ] Pan with click-drag in select tool (authenticated)
- [ ] Guest users can always pan
- [ ] Grid scales with zoom level

#### Selection
- [ ] Click shape to select
- [ ] Selected shape shows transformer handles
- [ ] Click empty canvas deselects
- [ ] Escape key deselects
- [ ] Selection persists during tool switches

#### Keyboard Shortcuts
- [ ] Delete/Backspace removes selected shape
- [ ] Escape deselects shape
- [ ] Shortcuts disabled when typing in text input

### 6. Edge Cases & Error Handling (`edge-cases.spec.ts`)
**Priority**: Low
**Coverage**: 10% of critical flows

#### Empty States
- [ ] New canvas shows empty state
- [ ] No shapes message displayed
- [ ] AI history empty state message
- [ ] Guest mode informational messages

#### Concurrent Operations
- [ ] Rapid shape creation doesn't create duplicates
- [ ] Rapid AI commands don't interfere
- [ ] Multiple users editing simultaneously without conflicts

#### Browser Compatibility
- [ ] All tests pass in Chromium
- [ ] All tests pass in Firefox
- [ ] Responsive canvas resizing

#### Error Recovery
- [ ] Invalid shape data handled gracefully
- [ ] Network errors don't crash app
- [ ] AI errors display helpful messages
- [ ] Connection lost/restored indicator

## Test Execution Strategy

### Parallel Execution
- Tests within different files run in parallel
- Each test uses isolated room ID or context
- Multi-user tests spawn multiple browser contexts

### Test Isolation
- Each test creates fresh room/context
- Clean up shapes after test (if possible)
- No shared state between tests

### Assertions
- Use Playwright auto-waiting features
- Explicit waits for network/sync: `page.waitForResponse()`
- Visual assertions: `expect(locator).toBeVisible()`
- Never use `waitForTimeout()` unless absolutely necessary

### Multi-Browser Testing
```typescript
// Example pattern for multi-user tests
const context1 = await browser.newContext();
const context2 = await browser.newContext();
const user1 = await context1.newPage();
const user2 = await context2.newPage();
// ... test collaboration
await context1.close();
await context2.close();
```

## Success Criteria

- ✅ 70-80% coverage of critical user flows
- ✅ All Phase 1 (AI Agent) features tested
- ✅ All Phase 2 (Enhanced Canvas) features tested
- ✅ Multi-user collaboration tested with 2+ contexts
- ✅ Authentication and authorization tested
- ✅ Real AI endpoint integration tested
- ✅ Tests organized logically by feature area
- ✅ Failing tests document real bugs (not test flakiness)
- ✅ Test execution time < 5 minutes for full suite

## Known Limitations (Not Tested)

- ❌ Exact millisecond timing measurements
- ❌ Precise FPS validation (use manual DevTools testing)
- ❌ Pixel-perfect rendering comparisons
- ❌ Network layer internals (Yjs sync protocol)
- ❌ Sub-100ms lag measurements
- ❌ Exact message rate counting (20 msgs/sec target)

## Coverage Summary

| Feature Area | Priority | Estimated Coverage |
|--------------|----------|-------------------|
| Authentication | Critical | 15% |
| Shapes | Critical | 25% |
| AI Agent | High | 20% |
| Collaboration | Critical | 20% |
| Canvas Interactions | Medium | 10% |
| Edge Cases | Low | 10% |
| **TOTAL** | | **~70-80%** |

## Next Steps

1. ✅ Create test plan
2. Install Playwright
3. Configure `playwright.config.ts`
4. Set up authentication fixtures
5. Implement tests in priority order:
   - auth.spec.ts
   - shapes.spec.ts
   - ai-agent.spec.ts
   - collaboration.spec.ts
   - canvas.spec.ts
   - edge-cases.spec.ts
6. Run full suite and iterate
7. Refactor into helpers/fixtures
8. Document failing tests that expose real bugs
