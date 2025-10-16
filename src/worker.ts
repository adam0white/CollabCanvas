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
import { TOOL_SCHEMA, type ToolCall } from "./ai-tools";

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

    // AI command endpoint: POST /c/:roomId/ai-command
    const aiRoute = parseAICommandRoute(url);
    if (aiRoute && request.method === "POST") {
      try {
        const { roomId } = aiRoute;
        const { role, userId, userName } = await getUserContext(request, env);
        if (role !== "editor") {
          return addSecurityHeaders(
            new Response(
              JSON.stringify({ error: "Unauthorized: sign in to use AI" }),
              { status: 401, headers: { "content-type": "application/json" } },
            ),
          );
        }

        const body = (await request.json().catch(() => ({}))) as {
          prompt?: string;
          context?: unknown;
          commandId?: string;
        };
        const rawPrompt = typeof body.prompt === "string" ? body.prompt : "";
        const prompt = sanitizeText(rawPrompt).slice(0, 1000);
        if (!prompt) {
          return addSecurityHeaders(
            new Response(
              JSON.stringify({ error: "Invalid prompt" }),
              { status: 400, headers: { "content-type": "application/json" } },
            ),
          );
        }

        const commandId = body.commandId ?? crypto.randomUUID();
        const contextPayload = body.context ?? {};

        // Call Workers AI (if available) to get tool calls
        let toolCalls: ToolCall[] = [];
        try {
          const ai = (env as unknown as { AI?: { run: (model: string, input: unknown) => Promise<unknown> } }).AI;
          if (!ai) {
            throw new Error("Workers AI not configured");
          }
          const model = (env as unknown as { AI_MODEL?: string }).AI_MODEL ??
            "@cf/meta/llama-3.1-8b-instruct";

          const messages = [
            {
              role: "system",
              content:
                "You are an AI canvas agent. Use the provided tools to create and manipulate shapes. Prefer exact tool calls.",
            },
            { role: "user", content: prompt },
          ];

          const aiResponse: unknown = await ai.run(model, {
            messages,
            tools: TOOL_SCHEMA,
            tool_choice: "auto",
          });

          toolCalls = extractToolCalls(aiResponse);
          if (!Array.isArray(toolCalls)) {
            throw new Error("AI did not return tool calls");
          }
        } catch (error) {
          console.error("[AI] Invocation failed:", error);
          return addSecurityHeaders(
            new Response(
              JSON.stringify({
                error: "AI unavailable. Please try again later.",
                details:
                  (error as Error)?.message ?? "Unknown AI error",
              }),
              { status: 502, headers: { "content-type": "application/json" } },
            ),
          );
        }

        // Send RPC to DO for atomic execution
        const id = env.RoomDO.idFromName(roomId);
        const stub = env.RoomDO.get(id);
        const rpcRequest = new Request(new URL(`/rooms/${roomId}`, request.url).toString(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-canvas-rpc": "executeAICommand",
          },
          body: JSON.stringify({
            commandId,
            prompt,
            context: contextPayload,
            toolCalls,
            userId,
            userName,
          }),
        });
        const rpcResponse = await stub.fetch(rpcRequest);
        return addSecurityHeaders(rpcResponse);
      } catch (error) {
        console.error("[AI] Route error:", error);
        return addSecurityHeaders(
          new Response(
            JSON.stringify({ error: "Failed to process AI command" }),
            { status: 500, headers: { "content-type": "application/json" } },
          ),
        );
      }
    }

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
  const clerkSecretKey = (env as unknown as { CLERK_SECRET_KEY?: string }).CLERK_SECRET_KEY;
  const secret = (env as unknown as { CLERK_SECRET_KEY?: string }).CLERK_SECRET_KEY;
  if (!clerkSecretKey && !secret) {
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
      secretKey: (clerkSecretKey ?? secret) as string,
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

async function getUserContext(
  request: Request,
  env: Env,
): Promise<{ role: "editor" | "viewer"; userId: string | null; userName: string | null }> {
  const role = await authorizeRequest(request, env, {} as ExecutionContext);
  let userId: string | null = null;
  let userName: string | null = null;
  try {
    const token = extractToken(request);
    const secret = (env as unknown as { CLERK_SECRET_KEY?: string }).CLERK_SECRET_KEY;
    if (token && secret) {
      const jwtPayload = await verifyToken(token, { secretKey: secret });
      userId = (jwtPayload as { sub?: string } | null | undefined)?.sub ?? null;
      // Clerk JWT may include name fields; we keep optional
      const nameLike = (jwtPayload as unknown as { username?: string; name?: string }) ?? {};
      userName = nameLike.username ?? nameLike.name ?? null;
    }
  } catch {
    // ignore; role will be viewer if token invalid
  }
  return { role, userId, userName };
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

function parseAICommandRoute(url: URL): { roomId: string } | null {
  // Expected: /c/{roomId}/ai-command
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 3 && segments[0] === "c" && segments[2] === "ai-command") {
    return { roomId: decodeURIComponent(segments[1]) };
  }
  return null;
}

export function sanitizeText(input: string): string {
  // Basic sanitization: strip HTML tags and control chars
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractToolCalls(aiResponse: unknown): ToolCall[] {
  // Try OpenAI-style
  const choices = (aiResponse as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }> }).choices;
  if (Array.isArray(choices) && choices[0]?.message?.tool_calls) {
    return choices[0].message.tool_calls.map((t) => ({
      name: (t.function?.name ?? "getCanvasState") as ToolCall["name"],
      arguments: safeParseJson(t.function?.arguments) ?? {},
    }));
  }
  // Try Cloudflare Workers AI tool_calls at top level
  const topTools = (aiResponse as { tool_calls?: Array<{ name?: string; arguments?: Record<string, unknown> }> }).tool_calls;
  if (Array.isArray(topTools)) {
    return topTools.map((t) => ({
      name: (t.name ?? "getCanvasState") as ToolCall["name"],
      arguments: t.arguments ?? {},
    }));
  }
  return [];
}

function safeParseJson(text: unknown): Record<string, unknown> | null {
  if (typeof text !== "string") return null;
  try {
    const obj = JSON.parse(text);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
