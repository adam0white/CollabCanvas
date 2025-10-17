# AI Performance & Tool Optimization

This document details the latest performance optimizations made to the AI integration in CollabCanvas.

## Latest Update: Performance & Tool Optimization

### Model Switch: Mistral Small 3.1
- **Changed from**: `@hf/nousresearch/hermes-2-pro-mistral-7b` (beta, slow)
- **Changed to**: `@cf/mistralai/mistral-small-3.1-24b-instruct`
- **Reason**: 
  - Better inference speed (not beta)
  - Larger context window (128k tokens)
  - Production-ready, reliable pricing
  - Better function calling accuracy
- **Impact**: Significantly faster AI responses, better timeout handling

### Unified Tool API: Single Call for Multiple Shapes
- **Problem**: Creating 10 shapes required 10 separate tool calls → slow, high latency
- **Solution**: Overloaded `createShape` to accept array of shapes
- **Old approach**: 
  ```typescript
  // AI made 10 separate calls:
  createShape({ type: "circle", x: 100, y: 100, ... })
  createShape({ type: "circle", x: 120, y: 100, ... })
  // ... 8 more calls
  ```
- **New approach**:
  ```typescript
  // AI makes 1 call with array:
  createShape({ 
    shapes: [
      { type: "circle", x: 100, y: 100, ... },
      { type: "circle", x: 120, y: 100, ... },
      // ... up to 50 shapes
    ]
  })
  ```
- **Impact**: Up to 10x faster for multi-shape commands, reduced API roundtrips

### Simplified System Prompt
- Reduced prompt length from ~600 chars to ~400 chars
- More concise, focused rules for AI
- Clearer size modifiers:
  - `tiny` = 40px
  - `small` = 80px  
  - `regular` = 150px
  - `large` = 250px
  - `huge` = 400px
- Direct instruction to ALWAYS use shapes array format
- Removed redundant instructions (e.g., removed mention of deprecated `createMultipleShapes`)

### Better Error Messages
- **Problem**: Generic error "Could not understand command" didn't help users
- **Solution**: 
  - AI text responses (when no tool calls) now surfaced to user
  - Shows actual AI reasoning for rejections
  - Example: Instead of "Could not understand command", shows "AI responded but didn't call any tools: I cannot create triangles, only rectangles, circles, or text."
- Validation errors more concise and actionable

### Updated Validation
- Now validates the new `shapes` array format
- More efficient: single pass through array
- Better error messages (shorter, clearer)
- Handles both old single-shape format (backward compatibility) and new array format

### Removed Redundant Tools
- Removed `createMultipleShapes` from AI_TOOLS array (tool schema)
- Kept function for backward compatibility in tests
- Dispatcher redirects old calls to new unified `createShape`
- Result: Cleaner tool schema for AI, less confusion

## Technical Details

### Changes to `src/ai-tools.ts`
1. Updated `createShape` tool schema to accept `shapes` array
2. Updated `createShape` implementation to handle both formats:
   - Array format: `{ shapes: [...] }` (new, primary)
   - Single format: `{ type, x, y, ... }` (backward compatibility)
3. Removed `createMultipleShapes` from `AI_TOOLS` array
4. Updated dispatcher to redirect old calls

### Changes to `src/worker.ts`
1. Changed AI model to `@cf/mistralai/mistral-small-3.1-24b-instruct`
2. Simplified system prompt (400 chars vs 600 chars)
3. Added AI text response extraction for better error messages:
   ```typescript
   if (response && typeof response === "object" && "response" in response) {
     const textResponse = (response as { response?: string }).response;
     throw new Error(`AI responded but didn't call any tools: ${textResponse || "unknown reason"}`);
   }
   ```
4. Updated `validateToolCalls` to handle new array format
5. Consolidated validation logic

## Performance Impact

### Before Optimization
- **10 shapes**: ~5-10 seconds (10 tool calls × 500ms-1s each)
- **Timeout risk**: High for 20+ shapes
- **Error feedback**: Generic "Could not understand command"

### After Optimization
- **10 shapes**: ~1-2 seconds (1 tool call)
- **50 shapes**: ~2-3 seconds (1 tool call)
- **Timeout risk**: Minimal (single call)
- **Error feedback**: Specific AI reasoning or validation errors

## Testing
- All 75 tests pass
- Backward compatibility maintained for old format
- Tests updated to use new format where applicable

## Future Optimizations
1. Batch other operations (e.g., `moveShape`, `updateStyle`)
2. Optimize system prompt further based on usage patterns
3. Implement streaming for real-time feedback
4. Add caching for common prompts

