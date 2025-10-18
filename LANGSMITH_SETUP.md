# LangSmith Setup

## Quick Start

1. Get LangSmith API key from https://smith.langchain.com
2. Set secrets:
```bash
wrangler secret put LANGSMITH_API_KEY
wrangler secret put LANGSMITH_PROJECT
```

3. Deploy:
```bash
npm run deploy
```

## Configuration

Optional environment variables in `wrangler.toml`:
- `LANGSMITH_ENDPOINT` (defaults to https://api.smith.langchain.com)

## What's Tracked

Every AI command creates a trace with:
- **Prompt & context** (user input, selected shapes, viewport)
- **LLM inference** (model, latency, token counts if available)
- **Tool executions** (tool name, parameters, results, shapes affected)
- **Final result** (success/failure, shapes created/modified)

## Viewing Traces

1. Go to https://smith.langchain.com
2. Select your project
3. View traces filtered by:
   - User ID
   - Command ID
   - Success/failure
   - Latency
   - Tool calls

## Disabling

LangSmith gracefully degrades if `LANGSMITH_API_KEY` is not set. The app works normally without tracing.
