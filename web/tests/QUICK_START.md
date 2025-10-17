# Quick Start Guide - Playwright E2E Tests

## 1. One-Time Setup

```bash
# From project root, install Playwright browsers
cd web
npx playwright install chromium firefox
```

## 2. Set Up Test Credentials

Create `web/.env.local`:

```env
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password
```

## 3. Start Backend (Required)

In a separate terminal:

```bash
# From project root
npm run dev:worker
```

## 4. Run Tests

```bash
# From web directory
npm run test:e2e          # Run all tests
npm run test:e2e:ui       # Interactive UI mode (recommended!)
npm run test:e2e:headed   # Watch tests run in browser
npm run test:e2e:debug    # Debug mode with breakpoints
```

## 5. Quick Smoke Test

Run a single fast test to verify setup:

```bash
npx playwright test auth.spec.ts --headed
```

## Common Commands

```bash
# Run specific file
npx playwright test ai-basic.spec.ts

# Run tests matching pattern
npx playwright test --grep "create rectangle"

# Run only failed tests
npx playwright test --last-failed

# Generate test report
npm run test:e2e:report
```

## Troubleshooting

### Tests hang at authentication
- Verify TEST_USER_EMAIL and TEST_USER_PASSWORD are set
- Check Clerk development keys are configured

### WebSocket connection fails
- Ensure backend is running: `npm run dev:worker`
- Check if port 5173 (Vite) and 8787 (Wrangler) are available

### Tests time out
- First run may be slow (browser installation, cache building)
- Try running with `--headed` to see what's happening

### "Cannot find module" errors
- Run `npm install` in web directory
- Verify Playwright is installed: `npx playwright --version`

## Test Structure

```
web/tests/e2e/
├── auth.spec.ts         # 5 tests - Auth flows
├── shapes.spec.ts       # 12 tests - Shape operations
├── collaboration.spec.ts # 15 tests - Multi-user sync
├── ai-basic.spec.ts     # 9 tests - AI basic tools
├── ai-advanced.spec.ts  # 15 tests - AI advanced tools
├── ai-history.spec.ts   # 8 tests - AI history & collab
├── ai-complex.spec.ts   # 12 tests - Complex AI commands
└── edge-cases.spec.ts   # 18 tests - Error handling
```

**Total: 8 files, ~100 tests**

## What's Covered

✅ Authentication (editor vs guest)  
✅ Shape creation (rectangle, circle, text)  
✅ Real-time collaboration (2+ users)  
✅ AI commands (create, move, resize, rotate, style, delete)  
✅ AI layout operations (horizontal, vertical, grid)  
✅ AI pattern matching (find by color, type, text)  
✅ AI complex commands (forms, navigation bars, grids)  
✅ AI history sync across users  
✅ Edge cases & error handling  

## Pro Tips

1. **Use UI mode**: `npm run test:e2e:ui` - Best debugging experience
2. **Check traces**: Failed tests generate traces in `test-results/`
3. **Parallel execution**: Tests run in parallel by default
4. **Test isolation**: Each test cleans up after itself
5. **Real AI**: Tests use real AI endpoint (no mocking)

## Next Steps

- Review `TEST_PLAN.md` for detailed test strategy
- Check `README.md` for comprehensive documentation
- Examine `fixtures.ts` for reusable test utilities
- Run tests and check for failures (they surface bugs!)

---

**Need Help?** Check the full README.md or Playwright docs: https://playwright.dev
