# Troubleshooting Guide - AI Agent Issues

## Issue: Shapes Not Being Created (200 OK but nothing happens)

### Symptoms
- AI commands return 200 OK
- Tool calls generated successfully
- No shapes appear on canvas
- AI history doesn't update
- No RoomDO execution logs

### Root Causes & Fixes

#### 1. Agent Context Not Available
**Problem**: `this.ctx` is undefined in Agent, causing `getRoomId()` to fail silently.

**Check logs for**:
```
[AIAgent] Getting room ID from DurableObjectId: { hasId: false, ... }
[AIAgent] ⚠ Could not retrieve room ID from DurableObjectId.name, using default 'main'
```

**Fix**: Ensure Agent is properly initialized with context. Check if `getAgentByName()` is being used correctly in worker.ts.

#### 2. RoomDO Not Being Called
**Problem**: Code doesn't reach `roomStub.executeAICommand()` due to silent error.

**Check logs for**:
- Missing: `[AIAgent] Executing commands for room: ...`
- Missing: `[AIAgent] Calling RoomDO.executeAICommand with X tool calls`
- Missing: `[RoomDO] ✓ executeAICommand called: ...`

**Fix**: Check if RoomDO binding is available and error handling isn't swallowing exceptions.

#### 3. AI Gateway Not Working in Local Dev
**Problem**: AI Gateway (`gateway_id = "aw-cf-ai"`) only works in production, not with `wrangler dev`.

**Expected behavior**:
- **Local dev (`wrangler dev`)**: Direct Workers AI, no gateway logs ✅ NORMAL
- **Production (`wrangler deploy`)**: Through AI Gateway, logs appear in dashboard ✅ EXPECTED

**To verify gateway in production**:
1. Deploy: `npm run deploy`
2. Send AI commands in production
3. Check Cloudflare Dashboard → AI → AI Gateway → aw-cf-ai
4. Logs should appear within 1-2 minutes

#### 4. Stringified Shapes Parameter
**Problem**: AI returns `shapes` as a string instead of array.

**Log warning**:
```
[AIAgent] ⚠ Fixing stringified shapes parameter
```

**This is NORMAL** - The code automatically fixes this. If you see this warning, it means:
- AI returned: `{"shapes": "[{...}]"}` (string)
- Code converts to: `{"shapes": [{...}]}` (array)
- Tool execution should still work ✅

#### 5. Text Response Instead of Tool Calls
**Problem**: AI returns text response instead of `tool_calls` array.

**Error**:
```
[AIAgent] Text response (no tool calls): {"name": "createShape", ...}
Error: AI responded but didn't call any tools
```

**Fix**: Code now extracts tool call from text response automatically. This happens when the model doesn't support function calling properly.

### Debugging Steps

1. **Check Agent initialization**:
   ```bash
   # Look for these logs when sending AI command:
   [AIAgent] Getting room ID from DurableObjectId: ...
   [AIAgent] ✓ Room ID retrieved: main
   [AIAgent] Executing commands for room: main
   ```

2. **Check RoomDO is called**:
   ```bash
   # Should see these logs:
   [AIAgent] Calling RoomDO.executeAICommand with 1 tool calls
   [RoomDO] ✓ executeAICommand called: ...
   ```

3. **Check tool execution**:
   ```bash
   # Should see:
   [RoomDO] ✓ Command executed successfully: { success: true, shapesCreated: 1 }
   [AIAgent] ✓ RoomDO execution result: { success: true, shapesCreated: 1 }
   ```

4. **If NO RoomDO logs appear**:
   - Agent might be throwing error before calling RoomDO
   - Check for error stack traces in console
   - Verify `env.RoomDO` binding exists

### Testing Commands

**Simple test**:
```bash
curl -X POST http://localhost:8787/c/main/ai-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"prompt": "create a red rectangle at 100, 200"}'
```

**Expected full log sequence**:
```
[AIAgent] Calling AI via Gateway (configured in wrangler.toml)
[AIAgent] System prompt length: 755
[AIAgent] User prompt length: 35
[AIAgent] ✓ AI response received
[AIAgent] ✓ Got 1 tool calls
[AIAgent] Generated 1 tool calls: [...]
[AIAgent] Getting room ID from DurableObjectId: { ... }
[AIAgent] ✓ Room ID retrieved: main
[AIAgent] Executing commands for room: main
[AIAgent] Calling RoomDO.executeAICommand with 1 tool calls
[RoomDO] ✓ executeAICommand called: { ... }
[RoomDO] ✓ Command executed successfully: { ... }
[AIAgent] ✓ RoomDO execution result: { success: true, shapesCreated: 1 }
POST /c/main/ai-command 200 OK
```

### Common Issues

#### Issue: "Missing namespace or room headers when connecting to AIAgent"
**Fix**: Use `getAgentByName(env.AIAgent, roomId)` instead of direct `agent.fetch()`.

#### Issue: Shapes created but not visible
**Check**: 
- Are shapes being synced via Yjs?
- Check browser console for Yjs sync errors
- Verify WebSocket connection is active

#### Issue: AI history not showing
**Check**:
- Is `aiHistory` Y.Array being updated in RoomDO?
- Are clients observing the Y.Array?
- Check Yjs sync logs

### Performance Notes

**Normal latencies**:
- Simple commands: 500-2000ms (AI inference)
- Complex commands: 1000-3000ms (multiple shapes)
- With Gateway (production): +50-100ms overhead

**If seeing >5s latency**:
- Check Workers AI status: https://www.cloudflarestatus.com/
- Check if model is overloaded
- Consider switching models

### AI Gateway Verification (Production Only)

1. **Deploy to production**:
   ```bash
   npm run deploy
   ```

2. **Send test commands** via production URL

3. **Check AI Gateway dashboard**:
   - Navigate to: Cloudflare Dashboard → AI → AI Gateway → aw-cf-ai
   - Should see:
     - Request count increasing
     - Latency metrics (P50/P95/P99)
     - Token usage
     - Cache hit/miss rates (if caching enabled)

4. **If no logs in gateway**:
   - Verify `gateway_id = "aw-cf-ai"` in wrangler.toml
   - Confirm gateway exists in dashboard
   - Check if requests are going through Workers AI directly (bypass gateway)
   - Gateway logs may take 1-2 minutes to appear

### Next Steps

If issues persist after following this guide:

1. **Capture full logs**:
   ```bash
   npm run dev:worker 2>&1 | tee debug.log
   # Send AI command
   # Share debug.log
   ```

2. **Check Durable Object state**:
   - Verify RoomDO is created
   - Check DO migrations applied
   - Look for DO hibernation issues

3. **Verify Agent bindings**:
   ```bash
   wrangler dev # Check output for AIAgent binding
   ```

4. **Test RoomDO directly** (bypass Agent):
   - Temporarily test by calling RoomDO from worker
   - Isolate if issue is Agent or RoomDO

---

**Last Updated**: October 18, 2025
**Status**: Active debugging guide
