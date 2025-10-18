/**
 * AI Agent Architecture for CollabCanvas
 * 
 * Implements a stateful AI agent that:
 * - Maintains canvas context (shapes, state)
 * - Has memory of recent operations
 * - Executes tools on the canvas
 * - Tracks conversation history
 * - Integrates with LangSmith for observability
 * 
 * Design Decision: Stateful agent per room (lives in Durable Object)
 * - Each room has its own agent instance
 * - Agent state persists with the room
 * - Agent has direct access to Yjs document
 * - Conversation history stored in agent memory
 */

import type { Doc } from "yjs";
import type { Client } from "langsmith";
import {
  AI_TOOLS,
  dispatchTool,
  type ToolCall,
  type ToolResult,
} from "./ai-tools";
import {
  type AICommandMetadata,
  type AICommandResult,
  type LangSmithEnv,
  type TracingContext,
  completeAICommandTrace,
  createLangSmithClient,
  startAICommandTrace,
  traceAIInference,
  traceToolExecution,
} from "./langsmith-tracing";

/**
 * Agent configuration
 */
export type AgentConfig = {
  model: string;
  maxHistoryLength: number;
  canvasSize: { width: number; height: number };
};

/**
 * Agent state (persisted with room)
 */
export type AgentState = {
  recentOperations: Array<{
    commandId: string;
    prompt: string;
    result: string;
    timestamp: number;
  }>;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
};

/**
 * Context for agent execution
 */
export type AgentContext = {
  userId: string;
  userName: string;
  selectedShapeIds?: string[];
  viewportCenter?: { x: number; y: number };
};

/**
 * AI Agent for Canvas Manipulation
 * 
 * Stateful agent that lives in the Durable Object and maintains:
 * - Canvas context (via Yjs doc)
 * - Recent operations history
 * - Conversation memory
 * - LangSmith tracing client
 */
export class CanvasAgent {
  private readonly config: AgentConfig;
  private readonly state: AgentState;
  private readonly langsmithClient: Client | null;
  private readonly langsmithProject: string;

  constructor(
    config: AgentConfig,
    env: LangSmithEnv,
    initialState?: AgentState,
  ) {
    this.config = config;
    this.state = initialState ?? {
      recentOperations: [],
      conversationHistory: [],
    };
    this.langsmithClient = createLangSmithClient(env);
    this.langsmithProject = env.LANGSMITH_PROJECT || "collabcanvas";

    console.log(
      `[Agent] Initialized with model ${config.model}, LangSmith: ${this.langsmithClient ? "enabled" : "disabled"}`,
    );
  }

  /**
   * Get current agent state (for persistence)
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Execute an AI command
   * 
   * Main entry point for AI operations:
   * 1. Start LangSmith trace
   * 2. Generate tool calls from prompt using AI
   * 3. Execute tools on Yjs document
   * 4. Update agent memory
   * 5. Complete trace
   */
  async executeCommand(
    doc: Doc,
    ai: Ai,
    commandId: string,
    prompt: string,
    context: AgentContext,
    roomId: string,
  ): Promise<AICommandResult> {
    const startTime = Date.now();

    // Start LangSmith tracing
    const traceContext = await startAICommandTrace(
      this.langsmithClient,
      {
        commandId,
        userId: context.userId,
        userName: context.userName,
        roomId,
        prompt,
        selectedShapeIds: context.selectedShapeIds,
        viewportCenter: context.viewportCenter,
      },
      this.langsmithProject,
    );

    try {
      // Generate tool calls from prompt
      const { toolCalls, inferenceTime, systemPrompt } =
        await this.generateToolCalls(ai, prompt, context, doc, traceContext);

      if (toolCalls.length === 0) {
        const result: AICommandResult = {
          success: false,
          message: "Could not understand command",
          toolCallsCount: 0,
          error:
            "AI did not generate any tool calls. Try rephrasing your command.",
          commandId,
        };

        await completeAICommandTrace(traceContext, result, Date.now());
        return result;
      }

      // Execute tools atomically
      const toolResults = await this.executeTools(
        doc,
        toolCalls,
        context.userId,
        traceContext,
      );

      // Collect results (use indexed loop for better performance)
      const shapesCreated: string[] = [];
      const shapesAffected: string[] = [];

      for (let i = 0; i < toolResults.length; i++) {
        const result = toolResults[i];
        if (result.success && result.shapeIds) {
          shapesAffected.push(...result.shapeIds);
          const toolCall = toolCalls[i];
          if (toolCall?.name === "createShape") {
            shapesCreated.push(...result.shapeIds);
          }
        }
      }

      // Build response message
      const responseMessage = this.buildResponseMessage(
        toolCalls,
        toolResults,
        shapesCreated,
      );

      // Update agent memory
      this.updateMemory(commandId, prompt, responseMessage);

      // Complete trace
      const finalResult: AICommandResult = {
        success: toolResults.every((r) => r.success),
        message: responseMessage,
        shapesCreated,
        shapesAffected,
        toolCallsCount: toolCalls.length,
        error: toolResults.find((r) => !r.success)?.error,
        commandId,
      };

      await completeAICommandTrace(traceContext, finalResult, Date.now());

      console.log(
        `[Agent] Command ${commandId} completed in ${Date.now() - startTime}ms: ${finalResult.message}`,
      );

      return finalResult;
    } catch (error) {
      console.error("[Agent] Command execution error:", error);

      const errorResult: AICommandResult = {
        success: false,
        message: "Failed to execute command",
        toolCallsCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        commandId,
      };

      await completeAICommandTrace(traceContext, errorResult, Date.now());
      return errorResult;
    }
  }

  /**
   * Generate tool calls from natural language prompt
   * 
   * Uses Workers AI with function calling to convert prompt to structured tool calls.
   * Includes canvas context and conversation history for better results.
   */
  private async generateToolCalls(
    ai: Ai,
    prompt: string,
    context: AgentContext,
    doc: Doc,
    traceContext: TracingContext | null,
  ): Promise<{
    toolCalls: ToolCall[];
    inferenceTime: number;
    systemPrompt: string;
  }> {
    const startTime = Date.now();

    // Build context-aware system prompt
    const systemPrompt = this.buildSystemPrompt(context, doc);

    console.log("[Agent] Calling Workers AI with context...");

    try {
      // Call Workers AI with function calling
      // biome-ignore lint/suspicious/noExplicitAny: Workers AI types don't include function calling yet
      const response = await (ai as any).run(this.config.model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        tools: AI_TOOLS,
      });

      const inferenceTime = Date.now() - startTime;

      // Trace the inference
      await traceAIInference(traceContext, {
        model: this.config.model,
        prompt,
        systemPrompt,
        toolsCount: AI_TOOLS.length,
        startTime,
        endTime: Date.now(),
        response,
        // Note: Workers AI doesn't provide token counts yet
        // We'll estimate or leave undefined
      });

      // Extract tool calls from response
      let toolCalls: ToolCall[] = [];

      if (response && typeof response === "object" && "tool_calls" in response) {
        const rawToolCalls = response.tool_calls as Array<{
          name: string;
          arguments: Record<string, unknown>;
        }>;

        console.log(`[Agent] Got ${rawToolCalls.length} tool calls from AI`);

        toolCalls = rawToolCalls.map((call) => ({
          name: call.name,
          parameters: call.arguments,
        }));
      } else if (
        response &&
        typeof response === "object" &&
        "response" in response
      ) {
        // Fallback: parse text response as JSON
        console.log("[Agent] No tool calls, trying to parse text response");
        const textResponse = (response as { response?: string }).response;
        try {
          const jsonMatch = textResponse?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.shapes && Array.isArray(parsed.shapes)) {
              toolCalls = [
                {
                  name: "createShape",
                  parameters: { shapes: parsed.shapes },
                },
              ];
            }
          }
        } catch (parseError) {
          console.error("[Agent] Failed to parse fallback response:", parseError);
        }
      }

      return { toolCalls, inferenceTime, systemPrompt };
    } catch (error) {
      console.error("[Agent] AI inference error:", error);

      // Trace the error
      await traceAIInference(traceContext, {
        model: this.config.model,
        prompt,
        systemPrompt,
        toolsCount: AI_TOOLS.length,
        startTime,
        endTime: Date.now(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return { toolCalls: [], inferenceTime: Date.now() - startTime, systemPrompt };
    }
  }

  /**
   * Build system prompt with canvas context and agent state
   */
  private buildSystemPrompt(context: AgentContext, doc: Doc): string {
    const centerX = context.viewportCenter?.x ?? this.config.canvasSize.width / 2;
    const centerY = context.viewportCenter?.y ?? this.config.canvasSize.height / 2;

    // Get current canvas state
    const shapesMap = doc.getMap("shapes");
    const shapeCount = shapesMap.size;

    let prompt = `You are a canvas manipulation AI agent. Canvas: ${this.config.canvasSize.width}x${this.config.canvasSize.height}px. Center: ${centerX},${centerY}. Current shapes: ${shapeCount}.

CRITICAL: Use proper JSON arrays, NOT stringified arrays!
✓ CORRECT: {shapes:[{type:"circle",x:100,y:200,radius:50}]}
✗ WRONG: {shapes:"[{type:'circle'...}]"}

Shape types:
- Circle: {type:"circle",x:100,y:200,radius:50,fill:"#FF0000"}
- Rectangle: {type:"rectangle",x:100,y:200,width:150,height:100,fill:"#0000FF"}
- Text: {type:"text",x:100,y:200,text:"Hello",fontSize:16,fill:"#000000"}

Colors (hex): red=#FF0000, blue=#0000FF, yellow=#FFFF00, green=#00FF00, purple=#800080
Sizes: tiny=40, small=80, normal=150, large=250, huge=400
Positions: center=${centerX},${centerY}, left=${centerX - 300}, right=${centerX + 300}`;

    // Add selected shapes context
    if (context.selectedShapeIds && context.selectedShapeIds.length > 0) {
      prompt += `\nSelected shapes: ${context.selectedShapeIds.slice(0, 3).join(", ")}`;
    }

    // Add recent operations context (helps with "undo that" or "move it again")
    if (this.state.recentOperations.length > 0) {
      const recent = this.state.recentOperations.slice(-2);
      prompt += "\n\nRecent operations:";
      for (const op of recent) {
        prompt += `\n- "${op.prompt}" → ${op.result}`;
      }
    }

    return prompt;
  }

  /**
   * Execute tool calls atomically
   * 
   * All tools execute within the same Yjs transaction (handled by caller).
   * Traces each tool execution in LangSmith.
   */
  private async executeTools(
    doc: Doc,
    toolCalls: ToolCall[],
    userId: string,
    traceContext: TracingContext | null,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const startTime = Date.now();
      console.log(`[Agent] Executing tool: ${toolCall.name}`);

      try {
        const result = dispatchTool(doc, toolCall, userId);
        results.push(result);

        // Trace tool execution
        await traceToolExecution(traceContext, {
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          startTime,
          endTime: Date.now(),
          result: {
            success: result.success,
            message: result.message,
            shapeIds: result.shapeIds,
            error: result.error,
          },
        });

        console.log(
          `[Agent] Tool ${toolCall.name}: ${result.success ? "✓" : "✗"} ${result.message}`,
        );
      } catch (error) {
        const errorResult: ToolResult = {
          success: false,
          message: `Tool ${toolCall.name} failed`,
          error: error instanceof Error ? error.message : "Unknown error",
        };
        results.push(errorResult);

        // Trace the error
        await traceToolExecution(traceContext, {
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          startTime,
          endTime: Date.now(),
          result: errorResult,
        });

        console.error(`[Agent] Tool ${toolCall.name} error:`, error);
      }
    }

    return results;
  }

  /**
   * Build human-readable response message from tool results
   */
  private buildResponseMessage(
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    shapesCreated: string[],
  ): string {
    if (shapesCreated.length > 0) {
      return `Created ${shapesCreated.length} shape${shapesCreated.length > 1 ? "s" : ""}`;
    }

    if (toolResults.length === 1) {
      return toolResults[0].message;
    }

    const successCount = toolResults.filter((r) => r.success).length;
    return `Executed ${successCount}/${toolResults.length} operations successfully`;
  }

  /**
   * Update agent memory with recent operation
   * 
   * Maintains a sliding window of recent operations for context.
   */
  private updateMemory(
    commandId: string,
    prompt: string,
    result: string,
  ): void {
    const timestamp = Date.now();

    // Add to recent operations
    this.state.recentOperations.push({
      commandId,
      prompt,
      result,
      timestamp,
    });

    // Trim to max length
    if (this.state.recentOperations.length > this.config.maxHistoryLength) {
      this.state.recentOperations = this.state.recentOperations.slice(
        -this.config.maxHistoryLength,
      );
    }

    // Add to conversation history
    this.state.conversationHistory.push(
      { role: "user", content: prompt, timestamp },
      { role: "assistant", content: result, timestamp },
    );

    // Trim conversation history
    const maxConversation = this.config.maxHistoryLength * 2;
    if (this.state.conversationHistory.length > maxConversation) {
      this.state.conversationHistory = this.state.conversationHistory.slice(
        -maxConversation,
      );
    }
  }

  /**
   * Get recent operations summary (for debugging/observability)
   */
  getRecentOperations(): Array<{
    prompt: string;
    result: string;
    timestamp: number;
  }> {
    return this.state.recentOperations.map((op) => ({
      prompt: op.prompt,
      result: op.result,
      timestamp: op.timestamp,
    }));
  }
}

/**
 * Create default agent configuration
 */
export function createDefaultAgentConfig(): AgentConfig {
  return {
    model: "@cf/meta/llama-3.1-8b-instruct",
    maxHistoryLength: 10,
    canvasSize: { width: 2000, height: 2000 },
  };
}
