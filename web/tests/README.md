# CollabCanvas E2E Test Suite

Comprehensive Playwright E2E test suite for CollabCanvas Phase 2.5.

## Test Coverage

### Test Files (8 specs)

1. **auth.spec.ts** - Authentication & Authorization
   - Guest/viewer access (read-only)
   - Editor authentication and permissions
   - AI command access control

2. **shapes.spec.ts** - Shape Creation & Editing
   - Rectangle, circle, text creation
   - Shape movement, resize, rotation
   - Shape deletion and persistence

3. **collaboration.spec.ts** - Real-Time Collaboration
   - Multi-user shape sync
   - Cursor presence
   - Real-time transform sync
   - WebSocket reconnection

4. **ai-basic.spec.ts** - AI Basic Tools
   - createShape (rectangle, circle, text)
   - moveShape
   - Color normalization
   - Basic error handling

5. **ai-advanced.spec.ts** - AI Advanced Tools
   - resizeShape, rotateShape
   - updateShapeStyle
   - deleteShape
   - arrangeShapes (horizontal, vertical, grid)
   - findShapes (pattern matching)

6. **ai-history.spec.ts** - AI History & Collaboration
   - History sync across users
   - Guest access to history
   - History persistence
   - Concurrent AI commands

7. **ai-complex.spec.ts** - Complex AI Commands
   - Multi-shape creation (forms, navigation bars)
   - Spatial context (relative positioning)
   - Grid layouts and complex compositions

8. **edge-cases.spec.ts** - Edge Cases & Error Handling
   - Empty canvas states
   - Invalid AI commands
   - Concurrent operations
   - Network issues
   - Shape operation edge cases

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run with UI mode (recommended for development)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View last test report
npm run test:e2e:report
```

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the `web` directory:

```env
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password
```

These credentials should be valid Clerk development keys.

## Prerequisites

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium firefox
   ```

3. **Start development server**:
   The tests will automatically start the dev server, but you can run it manually:
   ```bash
   npm run dev
   ```

4. **Backend must be running**:
   Ensure the Cloudflare Worker backend is running (via `wrangler dev` in project root).

## Test Structure

```
web/tests/
├── e2e/                    # Test specs
│   ├── auth.spec.ts
│   ├── shapes.spec.ts
│   ├── collaboration.spec.ts
│   ├── ai-basic.spec.ts
│   ├── ai-advanced.spec.ts
│   ├── ai-history.spec.ts
│   ├── ai-complex.spec.ts
│   └── edge-cases.spec.ts
├── fixtures.ts             # Reusable fixtures and helpers
├── TEST_PLAN.md           # Detailed test plan
└── README.md              # This file
```

## Fixtures & Helpers

### Fixtures

- `authenticatedPage`: Page with signed-in user
- `guestPage`: Page without authentication (read-only)
- `multiUserContexts`: Two separate browser contexts for collaboration testing

### Helper Functions

- `waitForShapeCount(page, count)`: Wait for specific number of shapes
- `createRectangleViaUI(page, x, y, width, height)`: Create shape via UI interaction
- `sendAICommand(page, prompt)`: Send AI command and wait for completion
- `waitForAIHistoryEntry(page, prompt)`: Wait for AI history entry to appear
- `deleteAllShapes(page)`: Clean up all shapes (for test isolation)

## Browser Support

Tests run on:
- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)

## Test Isolation

Each test is isolated:
- Separate browser contexts for multi-user tests
- Clean up shapes after each test
- Independent authentication sessions

## Debugging Failed Tests

1. **Check trace files**: Available in `playwright-report/`
2. **View screenshots**: Screenshots captured on failure
3. **Watch videos**: Video recordings for failed tests
4. **Use UI mode**: `npm run test:e2e:ui` for interactive debugging

## Known Limitations

### Not Tested (unfeasible or low-value)

- ❌ Exact sub-100ms lag measurements (timing races)
- ❌ Precise FPS validation (use manual DevTools instead)
- ❌ Pixel-perfect rendering comparisons
- ❌ Network layer internals (Yjs sync protocol details)

### Expected Failures

Some tests may fail initially as they surface real bugs. This is **good** - it means the test suite is working!

Common failure categories:
- AI endpoint not configured
- Authentication setup issues
- WebSocket connection timeouts
- Race conditions in concurrent operations

## CI/CD Integration

Tests are configured for CI with:
- Single worker (sequential execution)
- 2 retries for flaky tests
- HTML and list reporters
- Trace collection on failure

## Contributing

When adding new tests:

1. Use modern Playwright selectors: `page.getByRole()`, `page.getByText()`
2. Avoid `waitForTimeout()` - use proper assertions instead
3. Add cleanup in `afterEach()` hooks
4. Use descriptive test names
5. Test isolation - no dependencies between tests

## Metrics

- **Total test files**: 8
- **Estimated test count**: 100+ tests
- **Coverage target**: 70-80% of critical flows
- **Expected runtime**: 5-15 minutes (parallel execution)

## Support

For issues or questions:
1. Check `TEST_PLAN.md` for detailed test strategy
2. Review Playwright docs: https://playwright.dev
3. Check fixture implementations for reusable patterns

---

**Last Updated**: 2025-10-17  
**Playwright Version**: 1.56.1
