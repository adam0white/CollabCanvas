export { RoomDO } from "./room-do";

import { verifyToken } from "@clerk/backend";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: { "content-type": "text/plain" },
      });
    }

    if (url.pathname === "/clerk/config") {
      return new Response(
        JSON.stringify({ publishableKey: env.CLERK_PUBLISHABLE_KEY ?? "" }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (url.pathname === "/c/main" || url.pathname === "/c/main/") {
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
      return response;
    }

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

    return new Response("Not Found", { status: 404 });
  },
};

async function authorizeRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<string> {
  const clerkSecretKey = env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.warn(
      "CLERK_SECRET_KEY not configured; treating request as unauthenticated",
    );
    return "viewer";
  }

  const token = extractToken(request);
  if (!token) {
    console.log("[Auth] No token provided, defaulting to viewer");
    return "viewer";
  }

  try {
    // verifyToken returns the JWT payload directly (not wrapped in { claims: ... })
    const jwtPayload = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    console.log(
      "[Auth] JWT payload:",
      JSON.stringify({
        hasPayload: !!jwtPayload,
        payloadKeys: jwtPayload ? Object.keys(jwtPayload) : [],
        sub: jwtPayload?.sub,
      }),
    );

    // For MVP: Any authenticated user is an editor
    // Unauthenticated users are viewers (read-only)
    if (jwtPayload?.sub) {
      console.log("[Auth] Authenticated user:", jwtPayload.sub, "-> editor");
      return "editor";
    }

    console.log("[Auth] No valid sub claim, defaulting to viewer");
    return "viewer";
  } catch (error) {
    console.warn("[Auth] Failed to verify Clerk token:", error);
    return "viewer";
  }
}

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
