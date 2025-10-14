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

    if (
      url.pathname === "/c/main/ws" &&
      request.headers.get("upgrade") === "websocket"
    ) {
      const roomId = url.searchParams.get("roomId") ?? "default";
      const role = await authorizeRequest(request, env, ctx);

      const id = env.RoomDO.idFromName(roomId);
      const stub = env.RoomDO.get(id);
      const targetUrl = new URL(`/rooms/${roomId}`, request.url);

      const headers = new Headers(request.headers);
      headers.set("x-collabcanvas-role", role);

      const targetRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers,
      });

      return stub.fetch(targetRequest);
    }

    if (url.pathname === "/c/main/ws") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
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

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) {
    return "viewer";
  }

  try {
    const verification = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    const claims = verification.claims as { org_role?: string };
    return claims.org_role === "editor" ? "editor" : "viewer";
  } catch (error) {
    console.warn("Failed to verify Clerk token", error);
    return "viewer";
  }
}
