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
    // Log only role assignments, not every socket
    if (role === "editor") {
      console.log(
        "[RoomDO] Editor connected, total sockets:",
        this.sockets.size,
      );
    }
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
