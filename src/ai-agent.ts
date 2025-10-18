/**
 * AIAgent - Cloudflare Agent for AI Canvas Operations
 *
 * This Agent handles AI command requests and integrates with RoomDO
 * for atomic Yjs updates. Each room gets its own Agent instance mapped
 * to the room ID.
 *
 * Architecture:
 * - Agent extends Cloudflare's Agent base class
 * - Maintains AI conversation state and idempotency cache
 * - Routes tool executions to RoomDO via RPC
 * - Uses AI Gateway for observability, caching, and cost tracking
 * - Built-in state management via Agent framework
 */

import { verifyToken } from "@clerk/backend";
import { Agent } from "agents";
import type { ToolCall } from "./ai-tools";
import { AI_TOOLS } from "./ai-tools";

/**
 * AIAgent - Handles AI commands for canvas manipulation
 *
 * Each room gets its own Agent instance (mapped by room ID).
 * Agent maintains:
 * - Recent operations cache for idempotency
 * - Conversation context
 * - Command execution history
 */
// biome-ignore lint/suspicious/noExplicitAny: Env type from worker-configuration.d.ts not properly recognized in Agent context
export class AIAgent extends Agent<any> {
  /**
   * Handle HTTP requests for AI commands
   * Route: POST /ai-command
   *
   * This replaces the Worker route handler and provides
   * built-in state management for idempotency and context.
   */
  async onRequest(request: Request): Promise<Response> {
    // Only handle POST requests for AI commands
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify authentication - only editors can send AI commands
    const role = await this.authorizeRequest(request);
    if (role !== "editor") {
      return Response.json(
        {
          success: false,
          error: "Unauthorized. Sign in to use AI commands.",
        },
        { status: 401 },
      );
    }

    // Parse and validate request body
    let body: {
      prompt?: string;
      context?: {
        selectedShapeIds?: string[];
        viewportCenter?: { x: number; y: number };
      };
    };

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    // Validate prompt
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return Response.json(
        { success: false, error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Sanitize and validate prompt length
    const MAX_PROMPT_LENGTH = 1000;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return Response.json(
        {
          success: false,
          error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }

    // Generate unique command ID
    const commandId = crypto.randomUUID();

    // Get user info from JWT
    const { userId, userName } = await this.getUserInfo(request);

    try {
      // Check idempotency in Agent state
      const cachedResult = await this.getCachedCommand(commandId);
      if (cachedResult) {
        console.log(`[AIAgent] Returning cached result for ${commandId}`);
        return Response.json(cachedResult);
      }

      // Call AI via Gateway to generate tool calls
      const toolCalls = await this.generateToolCallsWithAI(
        prompt,
        body.context ?? {},
      );

      if (toolCalls.length === 0) {
        return Response.json(
          {
            success: false,
            error:
              "Could not understand command. Try something like 'create a red rectangle at 100, 200'",
          },
          { status: 400 },
        );
      }

      console.log(
        `[AIAgent] Generated ${toolCalls.length} tool calls:`,
        toolCalls.map(
          (t) => `${t.name}(${JSON.stringify(t.parameters).slice(0, 100)})`,
        ),
      );

      // Validate tool calls before execution
      const validation = this.validateToolCalls(toolCalls);
      if (!validation.valid) {
        console.warn("[AIAgent] Validation failed:", validation.errors);
        return Response.json(
          {
            success: false,
            error: validation.errors.join("; "),
            message: "AI generated invalid commands",
          },
          { status: 400 },
        );
      }

      // Get RoomDO stub and execute via RPC
      const roomId = this.getRoomId();
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for Env binding
      const env = this.env as any;
      const roomStub = env.RoomDO.get(env.RoomDO.idFromName(roomId));

      const result = await roomStub.executeAICommand({
        commandId,
        toolCalls,
        userId,
        userName,
        prompt,
      });

      // Cache result in Agent state
      await this.cacheCommandResult(commandId, result);

      return Response.json(result, {
        status: result.success ? 200 : 500,
      });
    } catch (error) {
      console.error("[AIAgent] Error:", error);
      return Response.json(
        {
          success: false,
          error: "Failed to execute AI command",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  }

  /**
   * Generate tool calls using Workers AI via AI Gateway
   *
   * This method routes AI requests through AI Gateway for:
   * - Observability (request logs, latency tracking)
   * - Caching (common prompts cached at gateway)
   * - Cost tracking (monitor AI usage)
   * - Failover (gateway handles retries)
   */
  private async generateToolCallsWithAI(
    prompt: string,
    context: {
      selectedShapeIds?: string[];
      viewportCenter?: { x: number; y: number };
    },
  ): Promise<ToolCall[]> {
    const centerX = context.viewportCenter?.x ?? 1000;
    const centerY = context.viewportCenter?.y ?? 1000;

    // Build system prompt
    let systemPrompt = `Canvas 2000x2000. Center: ${centerX},${centerY}

CRITICAL: Use proper JSON arrays, NOT stringified arrays!
✓ CORRECT: {shapes:[{type:"circle",x:100,y:200,radius:50}]}
✗ WRONG: {shapes:"[{type:'circle'...}]"}

Format examples:
- Circle: {shapes:[{type:"circle",x:100,y:200,radius:50,fill:"#FF0000"}]}
- Rectangle: {shapes:[{type:"rectangle",x:100,y:200,width:150,height:100,fill:"#0000FF"}]}
- Text: {shapes:[{type:"text",x:100,y:200,text:"Hello",fontSize:16,fill:"#000000"}]}
- Multiple: {shapes:[{type:"circle",...},{type:"rectangle",...}]}

Colors (hex): red=#FF0000, blue=#0000FF, yellow=#FFFF00, green=#00FF00, purple=#800080, pink=#FFC0CB, orange=#FFA500
Sizes: tiny=40, small=80, normal=150, large=250, huge=400
Positions: center=${centerX},${centerY}, left=${centerX - 300}, right=${centerX + 300}`;

    if (context.selectedShapeIds && context.selectedShapeIds.length > 0) {
      systemPrompt += `\nSelected:${context.selectedShapeIds.slice(0, 2).join(",")}`;
    }

    try {
      console.log(
        "[AIAgent] Calling AI via Gateway (configured in wrangler.toml)",
      );
      console.log("[AIAgent] System prompt length:", systemPrompt.length);
      console.log("[AIAgent] User prompt length:", prompt.length);

      // Call Workers AI through AI Gateway
      // Gateway is configured in wrangler.toml [ai] section
      // All AI requests automatically flow through gateway for:
      // - Observability (request logs, latency tracking)
      // - Caching (common prompts cached at gateway)
      // - Cost tracking (monitor AI usage)
      // - Failover (gateway handles retries)
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion for Env binding
      const env = this.env as any;
      const ai = env.AI;

      // biome-ignore lint/suspicious/noExplicitAny: Workers AI types don't include function calling yet
      const response = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        tools: AI_TOOLS,
      });

      console.log("[AIAgent] ✓ AI response received");

      // Extract tool calls from response
      if (
        response &&
        typeof response === "object" &&
        "tool_calls" in response
      ) {
        const toolCalls = response.tool_calls as Array<{
          name: string;
          arguments: Record<string, unknown>;
        }>;

        console.log("[AIAgent] ✓ Got", toolCalls.length, "tool calls");

        // Parse and fix stringified shapes parameters
        return toolCalls.map((call) => {
          const params = call.arguments;

          // Fix: AI sometimes returns shapes as stringified JSON
          if (params.shapes && typeof params.shapes === "string") {
            console.warn("[AIAgent] ⚠ Fixing stringified shapes parameter");
            try {
              params.shapes = JSON.parse(params.shapes);
            } catch {
              // Try normalizing quotes
              try {
                const normalized = (params.shapes as string)
                  .replace(/'/g, '"')
                  .replace(/(\w+):/g, '"$1":');
                params.shapes = JSON.parse(normalized);
              } catch (parseError) {
                console.error("[AIAgent] Failed to parse shapes:", parseError);
              }
            }
          }

          return {
            name: call.name,
            parameters: params,
          };
        });
      }

      // Fallback: try to parse text response
      if (response && typeof response === "object" && "response" in response) {
        const textResponse = (response as { response?: string }).response;
        console.log("[AIAgent] Text response (no tool calls):", textResponse);

        // Try to extract JSON from text
        try {
          const jsonMatch = textResponse?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.shapes && Array.isArray(parsed.shapes)) {
              return [
                {
                  name: "createShape",
                  parameters: { shapes: parsed.shapes },
                },
              ];
            }
          }
        } catch (parseError) {
          console.error(
            "[AIAgent] Failed to parse JSON from text:",
            parseError,
          );
        }

        throw new Error(
          `AI responded but didn't call any tools: ${textResponse || "unknown reason"}`,
        );
      }

      return [];
    } catch (error) {
      console.error("[AIAgent] AI call failed:", error);
      throw new Error(
        `AI inference failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate tool calls before execution
   */
  private validateToolCalls(
    toolCalls: Array<{ name: string; parameters: Record<string, unknown> }>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    let totalShapesToCreate = 0;
    const MAX_SHAPES = 50;
    const MIN_RECTANGLE_SIZE = 10;
    const MIN_CIRCLE_RADIUS = 5;

    for (const call of toolCalls) {
      if (call.name === "createShape") {
        const params = call.parameters;

        // Handle array format
        if ("shapes" in params && Array.isArray(params.shapes)) {
          const shapes = params.shapes as Array<Record<string, unknown>>;
          totalShapesToCreate += shapes.length;

          for (const shape of shapes) {
            if (shape.type === "rectangle") {
              const width = shape.width as number;
              const height = shape.height as number;
              if (
                width &&
                height &&
                (width < MIN_RECTANGLE_SIZE || height < MIN_RECTANGLE_SIZE)
              ) {
                errors.push(
                  `Rectangle too small: ${width}x${height}px (min ${MIN_RECTANGLE_SIZE}x${MIN_RECTANGLE_SIZE}px)`,
                );
              }
            } else if (shape.type === "circle") {
              const radius = shape.radius as number;
              if (radius && radius < MIN_CIRCLE_RADIUS) {
                errors.push(
                  `Circle too small: ${radius}px radius (min ${MIN_CIRCLE_RADIUS}px)`,
                );
              }
            }
          }
        }
      }
    }

    if (totalShapesToCreate > MAX_SHAPES) {
      errors.push(
        `Total shapes requested: ${totalShapesToCreate}. Maximum is ${MAX_SHAPES} per command.`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get room ID from Agent instance ID
   * Agent instances are mapped 1:1 with rooms using idFromName
   */
  private getRoomId(): string {
    // The Agent ID is the room ID (passed via idFromName in Worker)
    // Use the context id property (from Durable Object State)
    // biome-ignore lint/suspicious/noExplicitAny: Accessing DO state id
    const stateId = (this as any).ctx?.id;
    if (stateId) {
      return stateId.toString().split(":").pop() || "main";
    }
    return "main";
  }

  /**
   * Authorize request and return role
   */
  private async authorizeRequest(
    request: Request,
  ): Promise<"editor" | "viewer"> {
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for Env binding
    const env = this.env as any;
    const clerkSecretKey = env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      console.warn("[AIAgent] No CLERK_SECRET_KEY, treating as viewer");
      return "viewer";
    }

    const token = this.extractToken(request);
    if (!token) {
      return "viewer";
    }

    try {
      const jwtPayload = await verifyToken(token, {
        secretKey: clerkSecretKey,
      });

      if (jwtPayload?.sub) {
        return "editor";
      }

      return "viewer";
    } catch (error) {
      console.warn("[AIAgent] Token verification failed:", error);
      return "viewer";
    }
  }

  /**
   * Extract JWT token from request
   */
  private extractToken(request: Request): string | null {
    const url = new URL(request.url);
    const authHeader = request.headers.get("Authorization");
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
    const queryToken = url.searchParams.get("token");
    return headerToken ?? queryToken;
  }

  /**
   * Get user info from JWT
   */
  private async getUserInfo(
    request: Request,
  ): Promise<{ userId: string; userName: string }> {
    const token = this.extractToken(request);
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for Env binding
    const env = this.env as any;
    const clerkSecretKey = env.CLERK_SECRET_KEY;

    if (token && clerkSecretKey) {
      try {
        const jwtPayload = await verifyToken(token, {
          secretKey: clerkSecretKey,
        });
        if (jwtPayload?.sub) {
          return {
            userId: jwtPayload.sub,
            userName:
              (jwtPayload as { username?: string }).username ??
              `User ${jwtPayload.sub.slice(0, 8)}`,
          };
        }
      } catch {
        // Continue with anonymous
      }
    }

    return {
      userId: "anonymous",
      userName: "Anonymous",
    };
  }

  /**
   * Get cached command result from Agent state
   */
  private async getCachedCommand(
    commandId: string,
  ): Promise<Record<string, unknown> | null> {
    // Use Durable Object storage via ctx
    // biome-ignore lint/suspicious/noExplicitAny: Accessing DO storage
    const storage = (this as any).ctx?.storage;
    if (!storage) return null;

    const cache = (await storage.get(`command:${commandId}`)) as
      | Record<string, unknown>
      | undefined;
    return cache ?? null;
  }

  /**
   * Cache command result in Agent state
   */
  private async cacheCommandResult(
    commandId: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    // Store in Durable Object storage via ctx
    // biome-ignore lint/suspicious/noExplicitAny: Accessing DO storage
    const storage = (this as any).ctx?.storage;
    if (!storage) return;

    await storage.put(`command:${commandId}`, result);

    // Clean up old cache entries (keep last 50)
    const keys = await storage.list({ prefix: "command:" });
    if (keys.size > 50) {
      const keysToDelete = Array.from(keys.keys()).slice(0, keys.size - 50);
      await storage.delete(keysToDelete);
    }
  }
}
