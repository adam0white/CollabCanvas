export { RoomDO } from "./room-do";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: { "content-type": "text/plain" },
      });
    }

    if (url.pathname === "/c/main" || url.pathname === "/c/main/") {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    if (
      url.pathname === "/c/main/ws" &&
      request.headers.get("upgrade") === "websocket"
    ) {
      const roomId = url.searchParams.get("roomId") ?? "default";
      const id = env.RoomDO.idFromName(roomId);
      const stub = env.RoomDO.get(id);
      const targetUrl = new URL(`/rooms/${roomId}`, request.url);
      const targetRequest = new Request(targetUrl.toString(), request);
      return stub.fetch(targetRequest);
    }

    if (url.pathname === "/c/main/ws") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
