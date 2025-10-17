/**
 * CollabCanvas Worker - Main Entry Point
 *
 * Responsibilities:
 * - Route static assets (SPA) and API endpoints
 * - Handle WebSocket upgrades for real-time collaboration
 * - JWT authentication and role-based access control
 * - Security headers (CSP, X-Frame-Options, etc.)
 */

export { RoomDO } from "./room-do";

import { verifyToken } from "@clerk/backend";

/**
 * Adds security headers to HTTP responses
 * - Content Security Policy (CSP) to prevent XSS
 * - X-Frame-Options to prevent clickjacking
 * - Referrer-Policy for privacy
 */
function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Content Security Policy - allow inline scripts for Clerk and Vite
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.adamwhite.work https://static.cloudflareinsights.com; " +
      "script-src-elem 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.adamwhite.work https://static.cloudflareinsights.com; " +
      "worker-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "media-src 'self' data:; " +
      "connect-src 'self' wss: https:; " +
      "font-src 'self' data:; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'",
  );

  // Additional security headers
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return addSecurityHeaders(
        new Response("ok", {
          headers: { "content-type": "text/plain" },
        }),
      );
    }

    if (url.pathname === "/clerk/config") {
      return addSecurityHeaders(
        new Response(
          JSON.stringify({ publishableKey: env.CLERK_PUBLISHABLE_KEY ?? "" }),
          {
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }

    // Handle AI command route: POST /c/:roomId/ai-command
    const aiCommandRoute = parseAICommandRoute(url);
    if (aiCommandRoute && request.method === "POST") {
      return handleAICommand(request, env, ctx, aiCommandRoute.roomId);
    }

    // Handle WebSocket routes
    const canvasWsRoute = parseCanvasWebSocketRoute(url);
    if (canvasWsRoute) {
      if (request.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 400 });
      }

      const roomId = canvasWsRoute.roomId ?? "main";
      const role = await authorizeRequest(request, env, ctx);
      const token = extractToken(request);

      const id = env.RoomDO.idFromName(roomId);
      const stub = env.RoomDO.get(id);
      const targetUrl = new URL(`/rooms/${roomId}`, request.url);

      const headers = new Headers(request.headers);
      headers.set("x-collabcanvas-role", role);
      if (token) {
        targetUrl.searchParams.set("token", token);
      }

      const targetRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers,
      });

      return stub.fetch(targetRequest);
    }

    // Serve SPA for all other routes (let React Router handle client-side routing)
    // This includes /c/main, /privacy, /terms, and any other app routes
    const assetUrl = new URL(request.url);
    assetUrl.pathname = "/index.html";
    const assetRequest = new Request(assetUrl.toString(), {
      method: "GET",
      headers: request.headers,
    });
    const assetResponse = await env.ASSETS.fetch(assetRequest);

    const contentType = assetResponse.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return assetResponse;
    }

    const publishableKey = env.CLERK_PUBLISHABLE_KEY ?? "";
    const html = await assetResponse.text();
    const injected = html.replace(
      "</head>",
      `<script>window.__CLERK_PUBLISHABLE_KEY__=${JSON.stringify(publishableKey)};</script></head>`,
    );

    const response = new Response(
      request.method === "HEAD" ? null : injected,
      assetResponse,
    );
    response.headers.set("content-length", String(injected.length));
    return addSecurityHeaders(response);
  },
};

/**
 * Authorizes a request and returns the user's role
 *
 * @param request - Incoming HTTP request
 * @param env - Worker environment with Clerk secret
 * @returns "editor" for authenticated users, "viewer" for guests
 */
async function authorizeRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<"editor" | "viewer"> {
  const clerkSecretKey = env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.warn(
      "CLERK_SECRET_KEY not configured; treating request as unauthenticated",
    );
    return "viewer";
  }

  const token = extractToken(request);
  if (!token) {
    return "viewer";
  }

  try {
    const jwtPayload = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    // For MVP: Any authenticated user is an editor, unauthenticated users are viewers
    if (jwtPayload?.sub) {
      return "editor";
    }

    return "viewer";
  } catch (error) {
    console.warn("[Auth] Token verification failed:", error);
    return "viewer";
  }
}

/**
 * Extracts JWT token from request
 * Checks Authorization header first, then falls back to query parameter
 *
 * @param request - Incoming HTTP request
 * @returns JWT token string or null if not found
 */
function extractToken(request: Request): string | null {
  const url = new URL(request.url);
  const authHeader = request.headers.get("Authorization");
  const headerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const queryToken = url.searchParams.get("token");
  return headerToken ?? queryToken;
}

/**
 * Parses WebSocket routes for canvas collaboration.
 * Expected patterns:
 *   - /c/main/ws (roomId from path)
 *   - /c/main/ws?roomId=custom (roomId from query)
 *   - /c/{roomId}/ws (explicit room in path)
 * Returns null for malformed or unexpected paths.
 */
function parseCanvasWebSocketRoute(url: URL): { roomId: string | null } | null {
  const segments = url.pathname.split("/").filter(Boolean);

  // Must have at least: ["c", "main", "ws"] or ["c", "{room}", "ws"]
  if (segments.length < 3) {
    return null;
  }

  // Must start with /c/
  if (segments[0] !== "c") {
    return null;
  }

  // Must contain /ws segment
  const wsIndex = segments.lastIndexOf("ws");
  if (wsIndex === -1) {
    return null;
  }

  // ws must be at the end OR have exactly one segment after it (roomId)
  // Reject paths like /c/main/ws/extra/garbage
  if (wsIndex < segments.length - 2) {
    return null;
  }

  // ws should be at position 2 or 3: /c/main/ws or /c/main/ws/roomId
  if (wsIndex < 2 || wsIndex > 3) {
    return null;
  }

  // Extract roomId: either from path segment after ws, or from query param
  const roomSegment =
    wsIndex === segments.length - 2 ? segments[wsIndex + 1] : null;
  const roomId = roomSegment
    ? decodeURIComponent(roomSegment)
    : url.searchParams.get("roomId");

  return { roomId: roomId ?? null };
}

/**
 * Parses AI command routes.
 * Expected pattern: POST /c/:roomId/ai-command
 */
function parseAICommandRoute(url: URL): { roomId: string } | null {
  const segments = url.pathname.split("/").filter(Boolean);

  // Must match: ["c", "{roomId}", "ai-command"]
  if (segments.length !== 3) {
    return null;
  }

  if (segments[0] !== "c" || segments[2] !== "ai-command") {
    return null;
  }

  const roomId = decodeURIComponent(segments[1]);
  return { roomId };
}

/**
 * Handles AI command execution
 * 1. Verify JWT (editors only)
 * 2. Validate and sanitize input
 * 3. Call Workers AI for tool generation
 * 4. Execute tools via RPC to Durable Object
 */
async function handleAICommand(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  roomId: string,
): Promise<Response> {
  // Verify authentication - only editors can send AI commands
  const role = await authorizeRequest(request, env, ctx);
  if (role !== "editor") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized. Sign in to use AI commands.",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Parse request body
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
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Validate prompt
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return new Response(
      JSON.stringify({ success: false, error: "Prompt is required" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Sanitize and validate prompt length
  const MAX_PROMPT_LENGTH = 1000;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters.`,
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Generate unique command ID
  const commandId = crypto.randomUUID();

  // Get user info from JWT
  const token = extractToken(request);
  const clerkSecretKey = env.CLERK_SECRET_KEY;
  let userId = "anonymous";
  let userName = "Anonymous";

  if (token && clerkSecretKey) {
    try {
      const jwtPayload = await verifyToken(token, {
        secretKey: clerkSecretKey,
      });
      if (jwtPayload?.sub) {
        userId = jwtPayload.sub;
        // Try to get username from JWT claims
        userName =
          (jwtPayload as { username?: string }).username ??
          `User ${userId.slice(0, 8)}`;
      }
    } catch {
      // Continue with anonymous if token verification fails
    }
  }

  try {
    // Call Workers AI to generate tool calls from natural language
    const toolCalls = await generateToolCallsWithAI(
      env.AI,
      prompt,
      body.context ?? {},
    );

    if (toolCalls.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Could not understand command. Try something like 'create a red rectangle at 100, 200'",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    // Log tool calls for debugging
    console.log(
      `[AI] Generated ${toolCalls.length} tool calls:`,
      toolCalls.map(
        (t) => `${t.name}(${JSON.stringify(t.parameters).slice(0, 100)})`,
      ),
    );

    // Validate tool calls BEFORE execution
    const validation = validateToolCalls(toolCalls);
    if (!validation.valid) {
      console.warn("[AI] Validation failed:", validation.errors);
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.errors.join("; "),
          message: "AI generated invalid commands",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    // Get Durable Object stub and execute command via RPC
    const id = env.RoomDO.idFromName(roomId);
    const stub = env.RoomDO.get(id);

    const result = await stub.executeAICommand({
      commandId,
      toolCalls,
      userId,
      userName,
      prompt,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[AI Command] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to execute AI command",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

/**
 * Validate tool calls before execution to catch AI hallucinations
 */
function validateToolCalls(
  toolCalls: Array<{ name: string; parameters: Record<string, unknown> }>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let totalShapesToCreate = 0;
  const MAX_SHAPES = 50;
  const MIN_RECTANGLE_SIZE = 10;
  const MIN_CIRCLE_RADIUS = 5;

  for (const call of toolCalls) {
    // Count shapes being created
    if (call.name === "createShape") {
      const params = call.parameters;

      // Handle new array format
      if ("shapes" in params && Array.isArray(params.shapes)) {
        const shapes = params.shapes as Array<Record<string, unknown>>;
        totalShapesToCreate += shapes.length;

        // Validate each shape in the array
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
            if (width && width > 2000)
              errors.push(`Rectangle width ${width}px exceeds canvas`);
            if (height && height > 2000)
              errors.push(`Rectangle height ${height}px exceeds canvas`);
          } else if (shape.type === "circle") {
            const radius = shape.radius as number;
            if (radius && radius < MIN_CIRCLE_RADIUS) {
              errors.push(
                `Circle too small: ${radius}px radius (min ${MIN_CIRCLE_RADIUS}px)`,
              );
            }
            if (radius && radius > 1000)
              errors.push(`Circle radius ${radius}px too large`);
          } else if (shape.type === "text") {
            const fontSize = shape.fontSize as number;
            if (fontSize && fontSize < 8)
              errors.push(`Text too small: ${fontSize}px (min 8px)`);
            if (fontSize && fontSize > 200)
              errors.push(`Text too large: ${fontSize}px (max 200px)`);
          }

          // Check for unsupported types
          if (
            shape.type &&
            shape.type !== "rectangle" &&
            shape.type !== "circle" &&
            shape.type !== "text"
          ) {
            errors.push(
              `Unsupported shape: ${shape.type}. Only rectangles, circles, text.`,
            );
          }
        }
        continue;
      }

      // Handle old single-shape format (backward compatibility)
      totalShapesToCreate++;
      if (params.type === "rectangle") {
        const width = params.width as number;
        const height = params.height as number;
        if (
          width &&
          height &&
          (width < MIN_RECTANGLE_SIZE || height < MIN_RECTANGLE_SIZE)
        ) {
          errors.push(
            `Rectangle too small: ${width}x${height}px (minimum ${MIN_RECTANGLE_SIZE}x${MIN_RECTANGLE_SIZE}px)`,
          );
        }
        if (width && width > 2000) {
          errors.push(
            `Rectangle width ${width}px exceeds canvas size (2000px)`,
          );
        }
        if (height && height > 2000) {
          errors.push(
            `Rectangle height ${height}px exceeds canvas size (2000px)`,
          );
        }
      } else if (params.type === "circle") {
        const radius = params.radius as number;
        if (radius && radius < MIN_CIRCLE_RADIUS) {
          errors.push(
            `Circle too small: ${radius}px radius (minimum ${MIN_CIRCLE_RADIUS}px)`,
          );
        }
        if (radius && radius > 1000) {
          errors.push(`Circle radius ${radius}px exceeds reasonable size`);
        }
      } else if (params.type === "text") {
        const fontSize = params.fontSize as number;
        if (fontSize && fontSize < 8) {
          errors.push(`Text too small: ${fontSize}px (minimum 8px)`);
        }
        if (fontSize && fontSize > 200) {
          errors.push(`Text too large: ${fontSize}px (maximum 200px)`);
        }
      }

      // Check for unsupported types
      if (
        params.type &&
        params.type !== "rectangle" &&
        params.type !== "circle" &&
        params.type !== "text"
      ) {
        errors.push(
          `Unsupported shape type: ${params.type}. Only rectangles, circles, and text are supported.`,
        );
      }
    }
  }

  // Check total shapes across all calls
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
 * Call Workers AI with function calling to generate tool calls from natural language
 */
async function generateToolCallsWithAI(
  ai: Ai,
  prompt: string,
  context: {
    selectedShapeIds?: string[];
    viewportCenter?: { x: number; y: number };
  },
): Promise<
  {
    name: string;
    parameters: Record<string, unknown>;
  }[]
> {
  // Import AI_TOOLS from ai-tools module (outside try for error access)
  const { AI_TOOLS } = await import("./ai-tools");

  // Default to viewport center or canvas center
  const centerX = context.viewportCenter?.x ?? 1000;
  const centerY = context.viewportCenter?.y ?? 1000;

  // Ultra-minimal system prompt with explicit JSON formatting guidance
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
    // Log what we're sending (debug)
    console.log("[AI] System prompt length:", systemPrompt.length);
    console.log("[AI] User prompt length:", prompt.length);
    console.log("[AI] Tools count:", AI_TOOLS.length);
    console.log(
      "[AI] Tool schema size (approx):",
      JSON.stringify(AI_TOOLS).length,
      "chars",
    );
    console.log(
      "[AI] Total payload estimate:",
      systemPrompt.length + prompt.length + JSON.stringify(AI_TOOLS).length,
    );

    console.log(
      "[AI] Attempting function calling with Llama 3.1 8B Instruct (128k context)...",
    );

    // Use Cloudflare's stable Llama 3.1 model with 128k context window and tool support
    // This model is faster and more stable than beta models
    // biome-ignore lint/suspicious/noExplicitAny: Workers AI types don't include function calling yet
    let response: any;
    try {
      // Use standard run() with tools parameter for function calling
      // biome-ignore lint/suspicious/noExplicitAny: Workers AI tool calling not fully typed
      response = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        tools: AI_TOOLS,
      });

      console.log(
        "[AI] ✓ Llama 3.1 response received, checking for tool calls...",
      );
    } catch (funcCallError) {
      console.error(
        "[AI] Function calling with Llama 3.1 failed:",
        funcCallError,
      );
      console.log("[AI] Falling back to text parsing with standard run()...");

      // Fallback: Try without tools parameter using standard run API
      try {
        // biome-ignore lint/suspicious/noExplicitAny: Workers AI types are not fully typed
        response = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            {
              role: "system",
              content:
                systemPrompt +
                '\n\nRespond ONLY with valid JSON: {"shapes":[{"type":"...","x":...,"y":...}]}',
            },
            { role: "user", content: prompt },
          ],
        });

        // Parse text response as JSON
        if (
          response &&
          typeof response === "object" &&
          "response" in response
        ) {
          const textResponse = (response as { response?: string }).response;
          console.log("[AI] Got text response:", textResponse);

          // Try to extract JSON from response
          try {
            const jsonMatch = textResponse?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.shapes && Array.isArray(parsed.shapes)) {
                console.log(
                  "[AI] ✓ Parsed",
                  parsed.shapes.length,
                  "shapes from text response",
                );
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
              "[AI] Failed to parse JSON from text response:",
              parseError,
            );
          }
        }
      } catch (fallbackError) {
        console.error("[AI] Fallback also failed:", fallbackError);
        throw new Error(
          `AI request failed: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`,
        );
      }
    }

    // Extract tool calls from response
    if (response && typeof response === "object" && "tool_calls" in response) {
      const toolCalls = response.tool_calls as Array<{
        name: string;
        arguments: Record<string, unknown>;
      }>;

      console.log(
        "[AI] ✓ SUCCESS - Got",
        toolCalls.length,
        "tool calls from AI",
      );

      // Parse and validate tool call parameters
      return toolCalls.map((call) => {
        const params = call.arguments;

        // Fix: AI sometimes returns shapes as a stringified JSON array instead of actual array
        if (params.shapes && typeof params.shapes === "string") {
          console.warn(
            "[AI] ⚠ Fixing stringified shapes parameter - AI returned string instead of array",
          );
          console.log(
            "[AI] Raw shapes string:",
            params.shapes.substring(0, 200),
          );

          try {
            // Try 1: Direct JSON.parse
            params.shapes = JSON.parse(params.shapes);
            console.log(
              "[AI] ✓ Successfully parsed",
              Array.isArray(params.shapes) ? params.shapes.length : 0,
              "shapes from stringified parameter",
            );
          } catch (_parseError1) {
            console.warn(
              "[AI] Direct JSON.parse failed, trying with quote normalization...",
            );

            try {
              // Try 2: Replace single quotes with double quotes, then parse
              // This handles AI using JS object notation instead of JSON
              const normalized = (params.shapes as string)
                .replace(/'/g, '"') // Replace single quotes with double quotes
                .replace(/(\w+):/g, '"$1":'); // Add quotes around unquoted keys

              console.log(
                "[AI] Normalized string:",
                normalized.substring(0, 200),
              );
              params.shapes = JSON.parse(normalized);
              console.log(
                "[AI] ✓ Successfully parsed after normalization:",
                Array.isArray(params.shapes) ? params.shapes.length : 0,
                "shapes",
              );
            } catch (parseError2) {
              console.error(
                "[AI] ✗ Failed to parse even after normalization:",
                parseError2,
              );
              console.error("[AI] Original string:", params.shapes);
              // Keep as-is, let the tool handler deal with it
            }
          }
        }

        return {
          name: call.name,
          parameters: params,
        };
      });
    }

    // If AI gave text response but no tool calls, return it as error context
    if (response && typeof response === "object" && "response" in response) {
      const textResponse = (response as { response?: string }).response;
      console.log("[AI] Text response (no tool calls):", textResponse);
      // Return empty with error context
      throw new Error(
        `AI responded but didn't call any tools: ${textResponse || "unknown reason"}`,
      );
    }

    // Fallback to empty array if no tool calls
    console.warn("[AI] ⚠ No tool calls or response in AI output");
    return [];
  } catch (error) {
    console.error("[AI] ✘ FAILED - Workers AI error:", error);
    console.error(
      "[AI] Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "[AI] Error message:",
      error instanceof Error ? error.message : String(error),
    );

    // Throw error so frontend knows AI is broken
    throw new Error(
      `AI inference failed: ${error instanceof Error ? error.message : String(error)}. ` +
        `Check that the AI model is available and responding correctly.`,
    );
  }
}

/**
 * Simple command parser for MVP/fallback
 * Used when Workers AI is unavailable or errors out
 * Currently unused but kept for potential fallback scenarios
 */
function _parseSimpleCommand(prompt: string): {
  name: string;
  parameters: Record<string, unknown>;
}[] {
  const lower = prompt.toLowerCase();

  // Pattern: "create a [color] [shape] at x, y"
  const createMatch = lower.match(
    /create (?:a |an )?(\w+)?\s*(rectangle|circle|text|square)\s*(?:at\s*)?(?:(\d+)\s*,\s*(\d+))?/,
  );
  if (createMatch) {
    const [, color, shapeType, xStr, yStr] = createMatch;
    const x = xStr ? Number.parseInt(xStr, 10) : 200;
    const y = yStr ? Number.parseInt(yStr, 10) : 200;
    const type = shapeType === "square" ? "rectangle" : shapeType;

    const params: Record<string, unknown> = {
      type,
      x,
      y,
      fill: color || "#38bdf8",
    };

    if (type === "rectangle") {
      params.width = 150;
      params.height = 100;
    } else if (type === "circle") {
      params.radius = 50;
    } else if (type === "text") {
      params.text = "Hello World";
      params.fontSize = 24;
    }

    return [{ name: "createShape", parameters: params }];
  }

  // Pattern: "move shape [id] to x, y"
  const moveMatch = lower.match(
    /move\s+shape\s+([a-f0-9-]+)\s+to\s+(\d+)\s*,\s*(\d+)/,
  );
  if (moveMatch) {
    const [, shapeId, xStr, yStr] = moveMatch;
    return [
      {
        name: "moveShape",
        parameters: {
          shapeId,
          x: Number.parseInt(xStr, 10),
          y: Number.parseInt(yStr, 10),
        },
      },
    ];
  }

  // Pattern: "delete shape [id]" or "delete all [color] shapes"
  const deleteMatch = lower.match(/delete\s+(?:shape\s+)?([a-f0-9-]+)/);
  if (deleteMatch) {
    const [, shapeId] = deleteMatch;
    return [
      {
        name: "deleteShape",
        parameters: { shapeId },
      },
    ];
  }

  // Pattern: "make [shape-id] [color]" or "change [shape-id] to [color]"
  const colorMatch = lower.match(
    /(?:make|change)\s+([a-f0-9-]+)\s+(?:to\s+)?(\w+)/,
  );
  if (colorMatch) {
    const [, shapeId, color] = colorMatch;
    return [
      {
        name: "updateShapeStyle",
        parameters: { shapeId, fill: color },
      },
    ];
  }

  // Pattern: "rotate [shape-id] [degrees] degrees"
  const rotateMatch = lower.match(/rotate\s+([a-f0-9-]+)\s+(\d+)/);
  if (rotateMatch) {
    const [, shapeId, degrees] = rotateMatch;
    return [
      {
        name: "rotateShape",
        parameters: { shapeId, rotation: Number.parseInt(degrees, 10) },
      },
    ];
  }

  // Pattern: "resize [shape-id] to [width]x[height]"
  const resizeMatch = lower.match(/resize\s+([a-f0-9-]+)\s+to\s+(\d+)x(\d+)/);
  if (resizeMatch) {
    const [, shapeId, width, height] = resizeMatch;
    return [
      {
        name: "resizeShape",
        parameters: {
          shapeId,
          width: Number.parseInt(width, 10),
          height: Number.parseInt(height, 10),
        },
      },
    ];
  }

  // Pattern: "arrange shapes horizontally" or "arrange shapes in a row"
  const arrangeMatch = lower.match(
    /arrange\s+(?:shapes?\s+)?(?:in\s+)?(?:a\s+)?(horizontal|vertical|row|column|grid)/,
  );
  if (arrangeMatch) {
    const [, layoutType] = arrangeMatch;
    let _layout: "horizontal" | "vertical" | "grid" = "horizontal";
    if (layoutType === "vertical" || layoutType === "column") {
      _layout = "vertical";
    } else if (layoutType === "grid") {
      _layout = "grid";
    }

    // For MVP, this would need shape IDs - in production AI would use findShapes first
    return [
      {
        name: "getCanvasState",
        parameters: {},
      },
    ];
  }

  // Pattern: "create a login form" or "build a login form"
  const loginFormMatch = lower.match(
    /(?:create|build|make)\s+(?:a\s+)?login\s+form/,
  );
  if (loginFormMatch) {
    return [
      {
        name: "createMultipleShapes",
        parameters: {
          shapes: [
            {
              type: "text",
              x: 200,
              y: 200,
              text: "Username",
              fontSize: 16,
              fill: "#000000",
            },
            {
              type: "rectangle",
              x: 200,
              y: 230,
              width: 200,
              height: 40,
              fill: "#FFFFFF",
              stroke: "#D1D5DB",
              strokeWidth: 1,
            },
            {
              type: "text",
              x: 200,
              y: 280,
              text: "Password",
              fontSize: 16,
              fill: "#000000",
            },
            {
              type: "rectangle",
              x: 200,
              y: 310,
              width: 200,
              height: 40,
              fill: "#FFFFFF",
              stroke: "#D1D5DB",
              strokeWidth: 1,
            },
            {
              type: "rectangle",
              x: 200,
              y: 370,
              width: 200,
              height: 40,
              fill: "#3B82F6",
            },
            {
              type: "text",
              x: 270,
              y: 383,
              text: "Sign In",
              fontSize: 16,
              fill: "#FFFFFF",
            },
          ],
        },
      },
    ];
  }

  // Pattern: "create a navigation bar" or "build a nav bar"
  const navBarMatch = lower.match(
    /(?:create|build|make)\s+(?:a\s+)?(?:navigation\s+bar|nav(?:bar)?|navbar)/,
  );
  if (navBarMatch) {
    // Extract number of items if specified
    const itemsMatch = lower.match(/(\d+)\s+(?:items?|links?|buttons?)/);
    const itemCount = itemsMatch ? Number.parseInt(itemsMatch[1], 10) : 4;

    const shapes: Record<string, unknown>[] = [];
    const startX = 200;
    const startY = 200;
    const spacing = 100;

    for (let i = 0; i < itemCount; i++) {
      shapes.push({
        type: "text",
        x: startX + i * spacing,
        y: startY,
        text: `Link ${i + 1}`,
        fontSize: 16,
        fill: "#000000",
      });
    }

    return [
      {
        name: "createMultipleShapes",
        parameters: { shapes },
      },
    ];
  }

  // Pattern: "create a 3x3 grid of circles" or "make a grid of 9 squares"
  const gridMatch = lower.match(
    /(?:create|make|build)\s+(?:a\s+)?(\d+)x(\d+)\s+grid\s+of\s+(\w+)/,
  );
  if (gridMatch) {
    const [, rows, cols, shapeType] = gridMatch;
    const rowCount = Number.parseInt(rows, 10);
    const colCount = Number.parseInt(cols, 10);
    const type = shapeType === "squares" ? "rectangle" : shapeType;

    if (type !== "rectangle" && type !== "circle" && type !== "text") {
      return [];
    }

    const shapes: Record<string, unknown>[] = [];
    const startX = 200;
    const startY = 200;
    const size = 50;
    const spacing = 20;

    for (let row = 0; row < rowCount; row++) {
      for (let col = 0; col < colCount; col++) {
        const shape: Record<string, unknown> = {
          type,
          x: startX + col * (size + spacing),
          y: startY + row * (size + spacing),
          fill: "#38BDF8",
        };

        if (type === "rectangle") {
          shape.width = size;
          shape.height = size;
        } else if (type === "circle") {
          shape.radius = size / 2;
        } else if (type === "text") {
          shape.text = `${row},${col}`;
          shape.fontSize = 14;
        }

        shapes.push(shape);
      }
    }

    return [
      {
        name: "createMultipleShapes",
        parameters: { shapes },
      },
    ];
  }

  return [];
}
