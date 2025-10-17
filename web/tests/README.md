# CollabCanvas E2E Tests

Comprehensive Playwright test suite for CollabCanvas covering authentication, shapes, AI agent, collaboration, and edge cases.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create `web/.env` with test credentials:
   ```
   TEST_USER_EMAIL=your-test-email@example.com
   TEST_USER_PASSWORD=your-test-password
   ```

3. **Build Project**
   ```bash
   npm run build
   ```

## Running Tests

### Run All Tests
```bash
cd web
npm run test:e2e
```

### Run Tests in UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode (See Browser)
```bash
npm run test:e2e:headed
```

### Debug Tests
```bash
npm run test:e2e:debug
```

### Run Specific Test File
```bash
npx playwright test auth.spec.ts
```

### Run Tests in Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
```

## Test Structure

```
web/tests/
├── e2e/
│   ├── fixtures.ts              # Reusable test fixtures (auth, multi-user)
│   ├── helpers.ts               # Helper functions for common operations
│   ├── auth.spec.ts            # Authentication & authorization tests
│   ├── shapes.spec.ts          # Shape creation & editing tests
│   ├── ai-agent.spec.ts        # AI commands & history tests
│   ├── collaboration.spec.ts   # Real-time collaboration tests
│   ├── canvas.spec.ts          # Canvas interactions (pan, zoom, selection)
│   └── edge-cases.spec.ts      # Edge cases & error handling
├── TEST_PLAN.md               # Detailed test plan
└── README.md                  # This file
```

## Test Coverage

- ✅ **Authentication** (~15% of flows): Guest vs editor, role enforcement
- ✅ **Shapes** (~25% of flows): Rectangle, circle, text creation/editing/deletion
- ✅ **AI Agent** (~20% of flows): Basic, advanced, and complex AI commands
- ✅ **Collaboration** (~20% of flows): Cursor presence, shape sync, multi-user editing
- ✅ **Canvas** (~10% of flows): Pan, zoom, selection, keyboard shortcuts
- ✅ **Edge Cases** (~10% of flows): Empty states, concurrent ops, error handling

**Total Coverage: ~70-80% of critical user flows**

## Key Features

### Fixtures
- **authenticatedPage**: Automatically signs in using test credentials
- **guestPage**: Unauthenticated user context
- **multiUserContext**: Two authenticated users for collaboration testing
- **roomId**: Unique room ID for test isolation

### Helpers
- `createRectangle()`, `createCircle()`, `createText()`: Shape creation helpers
- `sendAICommand()`: AI command helper with timeout
- `selectShape()`, `deleteSelectedShape()`: Shape manipulation
- `navigateToSharedRoom()`: Multi-user test setup
- `waitForSync()`: Explicit wait for Yjs synchronization

### Best Practices
- ✅ Auto-waiting with Playwright locators
- ✅ Test isolation with unique room IDs
- ✅ Multi-browser testing (Chromium, Firefox)
- ✅ Trace on failure for debugging
- ✅ Video recording on failure
- ✅ Parallel execution for speed

## CI/CD Integration

Tests are configured to run in CI with:
- Retries (2 attempts)
- Limited parallelism (1 worker)
- Automatic report generation

## Debugging

### View Test Report
```bash
npx playwright show-report
```

### View Traces for Failed Tests
```bash
npx playwright show-trace <path-to-trace.zip>
```

### Enable Verbose Logging
```bash
DEBUG=pw:api npx playwright test
```

## Known Limitations

Tests do NOT cover:
- ❌ Exact millisecond timings
- ❌ Precise FPS measurements
- ❌ Pixel-perfect rendering
- ❌ Network layer internals (Yjs protocol)
- ❌ Sub-100ms lag validation

Use manual DevTools testing for these scenarios.

## Contributing

When adding new tests:
1. Use existing fixtures and helpers
2. Add new helpers to `helpers.ts` if reusable
3. Ensure test isolation (unique room IDs)
4. Add descriptive test names
5. Update TEST_PLAN.md if adding new coverage areas

## Troubleshooting

### Tests fail with "TEST_USER_EMAIL not set"
- Ensure `web/.env` file exists with valid credentials

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if dev server is running on port 8787

### Flaky tests
- Add explicit waits for Yjs sync: `await waitForSync(page)`
- Use `waitForSelector` instead of `waitForTimeout`
- Check for race conditions in multi-user tests

### Clerk auth fails
- Verify Clerk credentials in root `.env` file
- Check if test user exists in Clerk dashboard
- Try signing in manually at http://localhost:8787

## Resources

- [Playwright Documentation](https://playwright.dev)
- [CollabCanvas Architecture](../../ARCHITECTURE.md)
- [Test Plan](./TEST_PLAN.md)
