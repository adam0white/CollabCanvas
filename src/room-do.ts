/**
 * RoomDO - Durable Object for Real-time Collaboration
 *
 * Built on top of y-durableobjects for CRDT synchronization.
 *
 * Features:
 * - Yjs document sync across multiple clients
 * - Awareness protocol for presence (cursors, user info)
 * - Debounced persistence (500ms idle, 2s max)
 * - Role-based access control (editor/viewer)
 * - Automatic cleanup on disconnect
 *
 * Message Flow:
 * 1. WebSocket upgrade → registerWebSocket → assign role
 * 2. Client sends Yjs messages (Sync/Awareness)
 * 3. Viewers blocked from document updates
 * 4. Messages broadcast to other clients
 * 5. Changes persisted to Durable Object storage
 */

import { createDecoder, readVarUint, readVarUint8Array } from "lib0/decoding";
import { YDurableObjects } from "y-durableobjects";
import type { Awareness } from "y-protocols/awareness";
import { applyAwarenessUpdate } from "y-protocols/awareness";

import {
  createDebouncedCommit,
  type DebouncedCommitController,
} from "./utils/debounced-storage";

export const ROOM_PERSIST_IDLE_MS = 500;
export const ROOM_PERSIST_MAX_MS = 2000;

type DurableBindings = {
  Bindings: Env;
};

export class RoomDO extends YDurableObjects<DurableBindings> {
  private readonly commitScheduler: DebouncedCommitController;
  private readonly sockets = new Set<WebSocket>();
  private readonly awareness: Awareness;
  private readonly connectionRoles = new Map<WebSocket, ClientRole>();
  private readonly pendingConnections: ConnectionContext[] = [];
  private lastCommandId: string | null = null;
  private lastResult: unknown | null = null;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    this.commitScheduler = createDebouncedCommit({
      commit: () => this.storage.commit(),
      idleMs: ROOM_PERSIST_IDLE_MS,
      maxMs: ROOM_PERSIST_MAX_MS,
      waitUntil: (promise) => {
        void this.state.waitUntil(promise);
      },
    });

    this.awareness = this.doc.awareness;
    this.awareness.setLocalState({});

    this.awareness.on("update", () => {
      this.commitScheduler.schedule();
    });

    this.doc.on("update", () => {
      this.commitScheduler.schedule();
    });
  }

  override async fetch(request: Request): Promise<Response> {
    // RPC path: execute AI command
    const rpc = request.headers.get("x-canvas-rpc");
    if (rpc === "executeAICommand" && request.method === "POST") {
      try {
        const payload = (await request.json()) as {
          commandId: string;
          prompt: string;
          context: unknown;
          toolCalls: import("./ai-tools").ToolCall[];
          userId: string;
          userName: string;
        };

        if (!payload?.commandId) {
          return new Response(JSON.stringify({ error: "Missing commandId" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        // Idempotency: if same commandId, return cached result
        if (this.lastCommandId === payload.commandId && this.lastResult) {
          return new Response(JSON.stringify(this.lastResult), {
            headers: { "content-type": "application/json" },
          });
        }

        const { dispatchTool } = await import("./ai-tools");

        const start = Date.now();
        const execResults: import("./ai-tools").ToolResult[] = [];
        const affected: string[] = [];

        // Atomic execution within a single Yjs transaction
        this.doc.transact(() => {
          const ctx = {
            doc: this.doc,
            userId: payload.userId,
            userName: payload.userName,
            now: Date.now(),
          } satisfies import("./ai-tools").ExecuteContext;

          for (const call of payload.toolCalls) {
            const res = dispatchTool(ctx, call);
            // dispatchTool may be async in future; support sync now
            if (res instanceof Promise) {
              throw new Error("Async tools not supported in Phase 1");
            }
            execResults.push(res);
            if (res.ok && res.data && typeof res.data === "object") {
              const id = (res.data as { id?: string }).id;
              if (id) affected.push(id);
            }
          }

          // Minimal AI history append (Phase 1)
          try {
            const history = this.doc.getArray<Record<string, unknown>>("aiHistory");
            const entry = {
              id: payload.commandId,
              userId: payload.userId,
              userName: payload.userName,
              prompt: payload.prompt,
              response: execResults.every((r) => r.ok) ? "OK" : "Some tools failed",
              timestamp: Date.now(),
              shapesAffected: [...affected],
              success: execResults.every((r) => r.ok),
            };
            history.push([entry]);
          } catch (e) {
            console.warn("[DO] Failed to append aiHistory:", e);
          }
        });

        // Bounds enforcement (simple):
        if (affected.length > 50) {
          const error = "Too many shapes affected in one command (max 50)";
          const response = {
            success: false,
            message: error,
            shapesCreated: 0,
            shapesAffected: affected.length,
            error,
            commandId: payload.commandId,
            durationMs: Date.now() - start,
          };
          this.lastCommandId = payload.commandId;
          this.lastResult = response;
          return new Response(JSON.stringify(response), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const okCount = execResults.filter((r) => r.ok).length;
        const response = {
          success: okCount === execResults.length,
          message: okCount === execResults.length ? "OK" : "Some tools failed",
          shapesCreated: execResults.filter((r) => r.name === "createShape" && r.ok).length,
          shapesAffected: affected.length,
          error:
            okCount === execResults.length
              ? undefined
              : execResults.find((r) => !r.ok)?.error ?? "Unknown error",
          commandId: payload.commandId,
          results: execResults,
          durationMs: Date.now() - start,
        } as const;

        this.lastCommandId = payload.commandId;
        this.lastResult = response;

        return new Response(JSON.stringify(response), {
          headers: { "content-type": "application/json" },
        });
      } catch (error) {
        console.error("[DO] executeAICommand error:", error);
        return new Response(JSON.stringify({ error: "Failed to execute AI command" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Default path: websocket and Yjs sync
    const roleHeader = request.headers.get("x-collabcanvas-role");
    const role: ClientRole = roleHeader === "editor" ? "editor" : "viewer";
    this.pendingConnections.push({ role });

    try {
      return await super.fetch(request);
    } catch (error) {
      this.pendingConnections.pop();
      throw error;
    }
  }

  protected override registerWebSocket(ws: WebSocket): void {
    super.registerWebSocket(ws);
    this.sockets.add(ws);
    const context = this.pendingConnections.shift();
    const role = context?.role ?? "viewer";
    this.connectionRoles.set(ws, role);
  }

  protected override async unregisterWebSocket(ws: WebSocket): Promise<void> {
    this.sockets.delete(ws);
    this.connectionRoles.delete(ws);
    await super.unregisterWebSocket(ws);
    if (this.sockets.size < 1) {
      // Flush updates when last socket disconnects
      await this.commitScheduler.flush();
    }
  }

  protected override async cleanup(): Promise<void> {
    if (this.sockets.size < 1) {
      await this.commitScheduler.flush();
    }

    await super.cleanup();
  }


  override async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (message instanceof ArrayBuffer) {
      const messageType = peekMessageType(message);

      if (messageType === MessageType.Awareness) {
        const decoder = createDecoder(new Uint8Array(message));
        // Consume the message type varuint that we already inspected.
        void readVarUint(decoder);
        const update = readVarUint8Array(decoder);
        applyAwarenessUpdate(this.awareness, update, null);
        return;
      }

      if (messageType === MessageType.Sync) {
        const subtype = peekSyncSubtype(message);
        const role = this.connectionRoles.get(ws) ?? "viewer";

        if (role !== "editor" && subtype === SyncSubtype.Update) {
          // Viewers are not permitted to apply document updates.
          return;
        }
      }
    }

    await super.webSocketMessage(ws, message);
  }
}

type ClientRole = "editor" | "viewer";

type ConnectionContext = {
  role: ClientRole;
};

enum MessageType {
  Unknown = -1,
  Sync = 0,
  Awareness = 1,
}

enum SyncSubtype {
  Step1 = 0,
  Step2 = 1,
  Update = 2,
}

function peekMessageType(message: ArrayBuffer): MessageType {
  try {
    const decoder = createDecoder(new Uint8Array(message));
    const type = readVarUint(decoder);
    if (type === MessageType.Sync || type === MessageType.Awareness) {
      return type;
    }
  } catch {
    // fall through
  }

  return MessageType.Unknown;
}

function peekSyncSubtype(message: ArrayBuffer): SyncSubtype | null {
  try {
    const decoder = createDecoder(new Uint8Array(message));
    const type = readVarUint(decoder);
    if (type !== MessageType.Sync) {
      return null;
    }

    const subtype = readVarUint(decoder);
    if (
      subtype === SyncSubtype.Step1 ||
      subtype === SyncSubtype.Step2 ||
      subtype === SyncSubtype.Update
    ) {
      return subtype;
    }
  } catch {
    // fall through
  }

  return null;
}
