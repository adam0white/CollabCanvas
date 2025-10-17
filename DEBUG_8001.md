# Debugging 8001 Error - Step by Step

## What You'll See in Logs Now

### ✅ SUCCESS (No 8001 Error)
```
[AI] System prompt length: XXX
[AI] User prompt length: XXX
[AI] Tools count: 1
[AI] Tool schema size (approx): XXX chars
[AI] Total payload estimate: XXX
[AI] ✓ SUCCESS - Got 1 tool calls from AI
[AI] Generated 1 tool calls: [...]
POST /c/main/ai-command 200 OK
```

### ❌ FAILURE (8001 Error + Fallback)
```
[AI] System prompt length: XXX
[AI] User prompt length: XXX  
[AI] Tools count: 1
[AI] Tool schema size (approx): XXX chars
[AI] Total payload estimate: XXX
✘ [ERROR] [AI] ✘ FAILED - Workers AI error: ...
[AI] Error type: InferenceUpstreamError
[AI] Error message: 8001: Invalid input
[AI] ⚠ 8001 BadInput - Payload too large! Falling back to simple parser
[AI] To fix: Reduce system prompt or tool schema size
[AI] → Falling back to parseSimpleCommand
[AI] Fallback generated 1 tool calls
[AI] Generated 1 tool calls: [...]  ← OLD FORMAT (no shapes array)
POST /c/main/ai-command 200 OK (but used fallback)
```

## Changes Made

### 1. Reduced AI_TOOLS from 3 → 1 Tool
- **Removed**: `updateShapeStyle`, `deleteShape`
- **Kept**: Only `createShape` (the most important)
- **Why**: Smaller schema = less payload

### 2. Ultra-Minimal System Prompt
**Before** (593 chars):
```
Canvas: 2000x2000px. Supported shapes: rectangle, circle, text.
Center: (1000, 1000)

FORMAT (CRITICAL):
createShape({ shapes: [{ type: "rectangle", x: 100, y: 200, width: 150, height: 100, fill: "#FF0000" }] })

RULES:
- ALWAYS use shapes array (even for 1 shape)
- Colors MUST be hex: red=#FF0000, blue=#0000FF, ...
```

**After** (~350 chars):
```
Canvas 2000x2000. Center: 1000,1000
Format: createShape({shapes:[{type:"rectangle",x:100,y:200,width:150,height:100,fill:"#FF0000"}]})
Rules:
- ALWAYS use shapes:[] array
- Colors as hex: red=#FF0000,blue=#0000FF,yellow=#FFFF00,...
- Sizes: tiny=40,small=80,normal=150,large=250,huge=400
- Positions: center=1000,1000 left=700 right=1300
```

### 3. Enhanced Logging
- Shows exact payload sizes
- Clear success/failure markers (✓ / ✘)
- Shows when fallback is used
- Provides fix suggestions

## How to Debug

### Step 1: Run a Test Command
```
create a red rectangle
```

### Step 2: Check Logs for Payload Size
Look for these lines:
```
[AI] System prompt length: XXX
[AI] Tool schema size (approx): XXX chars
[AI] Total payload estimate: XXX
```

### Step 3: Identify the Issue

| Payload Size | Status | Action |
|--------------|--------|--------|
| < 2000 chars | ✓ Should work | If still failing, check Cloudflare status |
| 2000-3000 | ⚠ Risky | May work but unstable |
| > 3000 | ✘ Too large | Will get 8001 error |

### Step 4: Check Tool Call Format

**✓ CORRECT (from AI):**
```javascript
createShape({
  shapes: [{  // ← Has shapes array!
    type: "rectangle",
    x: 100,
    y: 200,
    width: 150,
    height: 100,
    fill: "#FF0000"
  }]
})
```

**✘ WRONG (from fallback):**
```javascript
createShape({
  type: "rectangle",  // ← No shapes array!
  x: 100,
  y: 200,
  width: 150,
  height: 100,
  fill: "red"  // ← Color name, not hex
})
```

## Current Status

With the new changes:
- **Tool count**: 1 (was 3, was 13)
- **System prompt**: ~350 chars (was 593, was 600)
- **Tool schema**: ~450 chars (was ~800, was ~2000)
- **Total estimate**: ~800 chars + user prompt

This should be well under any reasonable API limits.

## If Still Getting 8001

Try these in order:

1. **Check prompt length**: User prompts > 500 chars will push us over
   ```
   [AI] User prompt length: XXX  ← Should be < 500
   ```

2. **Try a simpler model**: Switch to a smaller model
   ```typescript
   // In src/worker.ts, line 648
   "@cf/meta/llama-3-8b-instruct"  // Instead of mistral
   ```

3. **Remove the format example**: If still too large
   ```typescript
   // Remove the line:
   Format: createShape({shapes:[...]})
   ```

4. **Check Cloudflare limits**: Wrangler local dev may have different limits
   ```bash
   # Deploy and test on production
   npx wrangler deploy
   ```

## Expected Logs for Successful Request

```
[AI] System prompt length: ~350
[AI] User prompt length: 25
[AI] Tools count: 1
[AI] Tool schema size (approx): ~450 chars
[AI] Total payload estimate: ~825
[AI] ✓ SUCCESS - Got 1 tool calls from AI
[AI] Generated 1 tool calls: [
  'createShape({"shapes":[{"type":"rectangle","x":1000,"y":1000,"width":150,"height":150,"fill":"#FF0000"}]})'
]
POST /c/main/ai-command 200 OK (1-3 seconds)
```

## Key Indicators

| Log Message | Meaning |
|-------------|---------|
| `✓ SUCCESS` | AI API worked! Using real AI |
| `✘ FAILED` | AI API errored, using fallback |
| `→ Falling back` | Using parseSimpleCommand |
| `8001 BadInput` | Payload too large |
| `shapes:[` in output | Correct format ✓ |
| `type:"` without `shapes:` | Wrong format (fallback) ✘ |

## Quick Test

Run this command and watch the logs:
```
create a red circle
```

**Expected log output:**
```
[AI] Total payload estimate: < 1000
[AI] ✓ SUCCESS - Got 1 tool calls from AI
[AI] Generated 1 tool calls: ['createShape({"shapes":[...]}')
```

If you see `✘ FAILED` or `8001`, copy the ENTIRE log output and we'll further optimize.

