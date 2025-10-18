/**
 * LangSmith Tracing Module
 *
 * Provides observability and tracing for AI operations in CollabCanvas.
 * Tracks: prompts, completions, tokens, latency, tool calls, success/failure.
 *
 * Integration with Cloudflare Workers:
 * - Uses fetch-based HTTP client (no Node.js dependencies)
 * - Async tracing (non-blocking)
 * - Graceful degradation if LangSmith unavailable
 */

import { Client } from "langsmith";
import type { RunCreate } from "langsmith/schemas";

/**
 * Environment interface for LangSmith configuration
 */
export interface LangSmithEnv {
  LANGSMITH_API_KEY?: string;
  LANGSMITH_PROJECT?: string;
  LANGSMITH_ENDPOINT?: string;
}

/**
 * LangSmith client configuration for Cloudflare Workers
 */
export function createLangSmithClient(env: LangSmithEnv): Client | null {
  // Check if LangSmith is configured
  if (!env.LANGSMITH_API_KEY) {
    console.warn("[LangSmith] API key not configured. Tracing disabled.");
    return null;
  }

  try {
    return new Client({
      apiKey: env.LANGSMITH_API_KEY,
      apiUrl: env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
    });
  } catch (error) {
    console.error("[LangSmith] Failed to create client:", error);
    return null;
  }
}

/**
 * Metadata for an AI command run
 */
export type AICommandMetadata = {
  commandId: string;
  userId: string;
  userName: string;
  roomId: string;
  prompt: string;
  selectedShapeIds?: string[];
  viewportCenter?: { x: number; y: number };
};

/**
 * Result of an AI command execution
 */
export type AICommandResult = {
  success: boolean;
  message: string;
  shapesCreated?: string[];
  shapesAffected?: string[];
  toolCallsCount: number;
  error?: string;
  commandId: string;
};

/**
 * Tracing context for an AI operation
 */
export type TracingContext = {
  runId: string;
  client: Client;
  projectName: string;
};

/**
 * Start tracing an AI command
 *
 * Creates a run in LangSmith with initial metadata.
 * Returns context for updating the run later.
 */
export async function startAICommandTrace(
  client: Client | null,
  metadata: AICommandMetadata,
  projectName: string,
): Promise<TracingContext | null> {
  if (!client) {
    return null;
  }

  try {
    const runId = crypto.randomUUID();
    const startTime = Date.now();

    // Create run in LangSmith
    await client.createRun({
      id: runId,
      name: "ai_command",
      run_type: "chain", // Use "chain" for multi-step AI operations
      inputs: {
        prompt: metadata.prompt,
        userId: metadata.userId,
        userName: metadata.userName,
        roomId: metadata.roomId,
        selectedShapeIds: metadata.selectedShapeIds,
        viewportCenter: metadata.viewportCenter,
      },
      extra: {
        metadata: {
          commandId: metadata.commandId,
          userId: metadata.userId,
          userName: metadata.userName,
          roomId: metadata.roomId,
          environment: "production",
        },
      },
      start_time: startTime,
      // project_name: projectName, // Note: project name set on client, not on individual runs
    });

    console.log(
      `[LangSmith] Started trace for command ${metadata.commandId}: ${runId}`,
    );

    return {
      runId,
      client,
      projectName,
    };
  } catch (error) {
    console.error("[LangSmith] Failed to start trace:", error);
    return null;
  }
}

/**
 * Log AI model inference within a trace
 *
 * Creates a child run for the LLM call with token counts and latency.
 */
export async function traceAIInference(
  context: TracingContext | null,
  params: {
    model: string;
    prompt: string;
    systemPrompt: string;
    toolsCount: number;
    startTime: number;
    endTime: number;
    response: unknown;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    error?: string;
  },
): Promise<void> {
  if (!context) {
    return;
  }

  try {
    const llmRunId = crypto.randomUUID();

    await context.client.createRun({
      id: llmRunId,
      name: "workers_ai_inference",
      run_type: "llm",
      inputs: {
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.prompt },
        ],
        tools_count: params.toolsCount,
      },
      outputs: params.error ? undefined : { response: params.response },
      error: params.error,
      extra: {
        metadata: {
          model: params.model,
          tools_count: params.toolsCount,
          latency_ms: params.endTime - params.startTime,
        },
        usage: params.promptTokens
          ? {
              prompt_tokens: params.promptTokens,
              completion_tokens: params.completionTokens,
              total_tokens: params.totalTokens,
            }
          : undefined,
      },
      start_time: params.startTime,
      end_time: params.endTime,
      parent_run_id: context.runId,
      // project_name: context.projectName, // Project name set on client
    });

    console.log(
      `[LangSmith] Traced LLM inference: ${params.model}, ${params.endTime - params.startTime}ms`,
    );
  } catch (error) {
    console.error("[LangSmith] Failed to trace LLM inference:", error);
  }
}

/**
 * Log tool execution within a trace
 *
 * Creates a child run for each tool call.
 */
export async function traceToolExecution(
  context: TracingContext | null,
  params: {
    toolName: string;
    parameters: unknown;
    startTime: number;
    endTime: number;
    result: {
      success: boolean;
      message: string;
      shapeIds?: string[];
      error?: string;
    };
  },
): Promise<void> {
  if (!context) {
    return;
  }

  try {
    const toolRunId = crypto.randomUUID();

    await context.client.createRun({
      id: toolRunId,
      name: `tool_${params.toolName}`,
      run_type: "tool",
      inputs: {
        tool_name: params.toolName,
        parameters: params.parameters,
      },
      outputs: params.result.success
        ? {
            message: params.result.message,
            shapeIds: params.result.shapeIds,
          }
        : undefined,
      error: params.result.error,
      extra: {
        metadata: {
          tool_name: params.toolName,
          success: params.result.success,
          shapes_affected: params.result.shapeIds?.length || 0,
          latency_ms: params.endTime - params.startTime,
        },
      },
      start_time: params.startTime,
      end_time: params.endTime,
      parent_run_id: context.runId,
      // project_name: context.projectName, // Project name set on client
    });
  } catch (error) {
    console.error("[LangSmith] Failed to trace tool execution:", error);
  }
}

/**
 * Complete an AI command trace
 *
 * Updates the run with final outputs and success status.
 */
export async function completeAICommandTrace(
  context: TracingContext | null,
  result: AICommandResult,
  endTime: number,
): Promise<void> {
  if (!context) {
    return;
  }

  try {
    await context.client.updateRun(context.runId, {
      outputs: result.success
        ? {
            message: result.message,
            shapesCreated: result.shapesCreated,
            shapesAffected: result.shapesAffected,
            toolCallsCount: result.toolCallsCount,
          }
        : undefined,
      error: result.error,
      end_time: endTime,
      extra: {
        metadata: {
          success: result.success,
          shapes_created: result.shapesCreated?.length || 0,
          shapes_affected: result.shapesAffected?.length || 0,
          tool_calls_count: result.toolCallsCount,
        },
      },
    });

    console.log(
      `[LangSmith] Completed trace ${context.runId}: ${result.success ? "success" : "failure"}`,
    );
  } catch (error) {
    console.error("[LangSmith] Failed to complete trace:", error);
  }
}

/**
 * Wrapper for tracing an async operation
 *
 * Handles errors gracefully and ensures tracing doesn't block execution.
 */
export async function withTracing<T>(
  operation: () => Promise<T>,
  onError?: (error: unknown) => void,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
}
