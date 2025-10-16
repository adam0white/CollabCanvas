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
    // For MVP: Simple tool execution without LLM
    // In production, this would call Workers AI or OpenAI to generate tool calls
    // For now, parse simple commands directly
    const toolCalls = parseSimpleCommand(prompt);

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
 * Simple command parser for MVP
 * In production, this would be replaced with Workers AI / OpenAI function calling
 */
function parseSimpleCommand(prompt: string): {
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
    let layout: "horizontal" | "vertical" | "grid" = "horizontal";
    if (layoutType === "vertical" || layoutType === "column") {
      layout = "vertical";
    } else if (layoutType === "grid") {
      layout = "grid";
    }

    // For MVP, this would need shape IDs - in production AI would use findShapes first
    return [
      {
        name: "getCanvasState",
        parameters: {},
      },
    ];
  }

  return [];
}
