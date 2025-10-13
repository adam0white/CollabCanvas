export class RoomDO implements DurableObject {
  constructor(readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Durable Object endpoint", { status: 200 });
  }
}
