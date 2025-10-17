# AI Test Plan - 5 Critical Commands

Test these 5 commands to verify all AI functionality works correctly. Each shows expected tool calls and final canvas state.

## Test 1: Basic Shape Creation with Colors

**Input:**
```
create a large red rectangle and a small blue circle
```

**Expected AI Tool Calls:**
```javascript
createShape({
  shapes: [
    {
      type: "rectangle",
      x: 1000,  // center
      y: 1000,
      width: 250,  // large
      height: 250,
      fill: "#FF0000"  // red
    },
    {
      type: "circle",
      x: 1000,
      y: 1000,
      radius: 40,  // small
      fill: "#0000FF"  // blue
    }
  ]
})
```

**Expected Canvas State:**
- 2 shapes total
- Red rectangle (250x250) at center
- Blue circle (40px radius) at center

---

## Test 2: Positional Commands

**Input:**
```
create a purple circle to the right and an orange circle to the left
```

**Expected AI Tool Calls:**
```javascript
createShape({
  shapes: [
    {
      type: "circle",
      x: 1300,  // right (center + 300)
      y: 1000,
      radius: 80,  // default small
      fill: "#800080"  // purple
    },
    {
      type: "circle",
      x: 700,  // left (center - 300)
      y: 1000,
      radius: 80,
      fill: "#FFA500"  // orange
    }
  ]
})
```

**Expected Canvas State:**
- 2 circles
- Purple circle at (1300, 1000), 80px radius
- Orange circle at (700, 1000), 80px radius
- Horizontally aligned with center between them

---

## Test 3: Size Modifiers

**Input:**
```
create 3 rectangles: tiny, normal, and huge
```

**Expected AI Tool Calls:**
```javascript
createShape({
  shapes: [
    {
      type: "rectangle",
      x: 900,
      y: 1000,
      width: 40,  // tiny
      height: 40,
      fill: "#3B82F6"  // default blue
    },
    {
      type: "rectangle",
      x: 1000,
      y: 1000,
      width: 150,  // normal
      height: 150,
      fill: "#3B82F6"
    },
    {
      type: "rectangle",
      x: 1200,
      y: 1000,
      width: 400,  // huge
      height: 400,
      fill: "#3B82F6"
    }
  ]
})
```

**Expected Canvas State:**
- 3 rectangles side by side
- Tiny (40x40), Normal (150x150), Huge (400x400)
- All blue colored
- Arranged horizontally near center

---

## Test 4: Text Shapes

**Input:**
```
create text that says "Hello World" at the center
```

**Expected AI Tool Calls:**
```javascript
createShape({
  shapes: [
    {
      type: "text",
      x: 1000,
      y: 1000,
      text: "Hello World",
      fontSize: 16,  // default
      fill: "#000000"  // black for text
    }
  ]
})
```

**Expected Canvas State:**
- 1 text shape at center
- Text: "Hello World"
- Font size: 16px
- Color: black

---

## Test 5: Exact Positioning

**Input:**
```
create a green rectangle at 200, 300 with size 100x150
```

**Expected AI Tool Calls:**
```javascript
createShape({
  shapes: [
    {
      type: "rectangle",
      x: 200,
      y: 300,
      width: 100,
      height: 150,
      fill: "#00FF00"  // green
    }
  ]
})
```

**Expected Canvas State:**
- 1 rectangle at exactly (200, 300)
- Size: 100x150 pixels
- Color: green

---

## Success Criteria

For each test, verify:

1. ✅ **No 8001 errors** - Should execute cleanly
2. ✅ **Correct tool format** - Uses `shapes` array
3. ✅ **Hex colors** - All colors are in `#RRGGBB` format
4. ✅ **Correct positioning** - Shapes appear where expected
5. ✅ **Correct sizes** - Size modifiers work correctly
6. ✅ **Shape count** - Exact number of shapes requested

---

## How to Verify

After each command:

1. Check browser console - should see:
   ```
   [AI] System prompt length: ~450
   [AI] Tools count: 3
   [AI] Generated 1 tool calls: [...]
   POST /c/main/ai-command 200 OK
   ```

2. Check canvas - shapes should be visible

3. Check AI history panel - should show success message like:
   ```
   ✓ Created 2 shapes
   2 shape(s) affected
   ```

4. NO errors in console - specifically no `8001: Invalid input`

---

## Common Issues to Watch For

| Issue | What to Check |
|-------|--------------|
| **"huge" in fill field** | AI should convert size to number, put in width/height/radius |
| **Color name instead of hex** | All colors should be `#RRGGBB` format |
| **Old format (no array)** | Should always see `shapes: [...]` in logs |
| **Wrong position** | Check viewport center is being used correctly |
| **8001 error** | Tool schema too large - check system prompt length |

---

## Debug Commands

If issues occur:

```bash
# Check what's being sent to AI
grep "\[AI\]" wrangler logs

# Expected output:
# [AI] System prompt length: ~450
# [AI] Tools count: 3
```

## Quick Summary Matrix

| Test | Shapes | Colors | Position | Size | Special |
|------|--------|--------|----------|------|---------|
| 1 | rect + circle | red, blue | center | large, small | Basic creation |
| 2 | 2 circles | purple, orange | left/right | default | Spatial |
| 3 | 3 rects | default blue | side by side | tiny/normal/huge | Size modifiers |
| 4 | text | black | center | default | Text handling |
| 5 | rect | green | exact coords | exact size | Precise control |

---

## Performance Benchmarks

- Each command should complete in **1-3 seconds**
- No timeouts
- No 8001 errors
- Console should be clean (only info logs, no errors)

