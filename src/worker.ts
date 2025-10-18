/**
 * CollabCanvas Worker - Main Entry Point
 *
 * Responsibilities:
 * - Route static assets (SPA) and API endpoints
 * - Handle WebSocket upgrades for real-time collaboration
 * - JWT authentication and role-based access control
 * - Security headers (CSP, X-Frame-Options, etc.)
 */

export { AIAgent } from "./ai-agent";
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
    // biome-ignore lint/suspicious/noExplicitAny: Env type from worker-configuration.d.ts - TypeScript has issues with Worker type generation
    env: Env | any,
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

    // Handle AI command route via AIAgent: POST /c/:roomId/ai-command
    const aiCommandRoute = parseAICommandRoute(url);
    if (aiCommandRoute && request.method === "POST") {
      return handleAICommandViaAgent(request, env, ctx, aiCommandRoute.roomId);
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
  // biome-ignore lint/suspicious/noExplicitAny: Env type from worker-configuration.d.ts
  env: Env | any,
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
 * Routes AI command to AIAgent (Cloudflare Agents architecture)
 *
 * Uses getAgentByName helper to properly connect to the Agent with required headers.
 */
async function handleAICommandViaAgent(
  request: Request,
  // biome-ignore lint/suspicious/noExplicitAny: Env type from worker-configuration.d.ts
  env: Env | any,
  _ctx: ExecutionContext,
  roomId: string,
): Promise<Response> {
  try {
    // Import the getAgentByName helper from agents package
    const { getAgentByName } = await import("agents");

    // Get the Agent instance using getAgentByName (proper way to connect to Agents)
    // This sets up the required namespace and room headers
    const agent = await getAgentByName(env.AIAgent, roomId);

    // Add room ID to the request headers so Agent can retrieve it
    const headers = new Headers(request.headers);
    headers.set("x-room-id", roomId);

    const agentRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
      duplex: "half",
    } as RequestInit);

    // Call the Agent's fetch method to process the request
    return agent.fetch(agentRequest);
  } catch (error) {
    console.error("[Worker] AIAgent routing error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to route to AI Agent",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
