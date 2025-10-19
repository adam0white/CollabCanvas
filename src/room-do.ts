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
import { dispatchTool, type ToolCall, type ToolResult } from "./ai-tools";
import {
  createDebouncedCommit,
  type DebouncedCommitController,
} from "./utils/debounced-storage";

export const ROOM_PERSIST_IDLE_MS = 500;
export const ROOM_PERSIST_MAX_MS = 2000;

type DurableBindings = {
  Bindings: Env;
};

// Idempotency tracking for AI commands
type CommandResult = {
  commandId: string;
  result: AICommandResult;
  timestamp: number;
};

export type AICommandResult = {
  success: boolean;
  message: string;
  shapesCreated?: string[];
  shapesAffected?: string[];
  error?: string;
  commandId: string;
};

export class RoomDO extends YDurableObjects<DurableBindings> {
  private readonly commitScheduler: DebouncedCommitController;
  private readonly sockets = new Set<WebSocket>();
  private readonly awareness: Awareness;
  private readonly connectionRoles = new Map<WebSocket, ClientRole>();
  private readonly pendingConnections: ConnectionContext[] = [];
  private readonly commandCache = new Map<string, CommandResult>();

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

  /**
   * RPC Method: Execute AI Command
   *
   * Executes AI tool calls within a single atomic Yjs transaction.
   * Implements idempotency checking to prevent duplicate execution.
   *
   * @param params - Command parameters including toolCalls, userId, userName
   * @returns Result object with success status and affected shape IDs
   */
  async executeAICommand(params: {
    commandId: string;
    toolCalls: ToolCall[];
    userId: string;
    userName: string;
    prompt: string;
  }): Promise<AICommandResult> {
    const { commandId, toolCalls, userId, userName, prompt } = params;

    // Idempotency check: return cached result if command already executed
    const cached = this.commandCache.get(commandId);
    if (cached) {
      return cached.result;
    }

    // Validate bounds: limit shapes per command
    const MAX_SHAPES = 50;
    const createToolCount = toolCalls.filter(
      (t) => t.name === "createShape",
    ).length;
    if (createToolCount > MAX_SHAPES) {
      const result: AICommandResult = {
        success: false,
        message: `Too many shapes requested: ${createToolCount}. Maximum is ${MAX_SHAPES}.`,
        error: "Exceeded shape limit",
        commandId,
      };
      this.commandCache.set(commandId, {
        commandId,
        result,
        timestamp: Date.now(),
      });
      return result;
    }

    try {
      const shapesCreated: string[] = [];
      const shapesAffected: string[] = [];
      const toolResults: ToolResult[] = [];

      // Execute all tools within a single Yjs transaction (atomic)
      this.doc.transact(() => {
        for (const toolCall of toolCalls) {
          const result = dispatchTool(this.doc, toolCall, userId);
          toolResults.push(result);

          if (result.success) {
            // Prefer shapeIds array over single shapeId to avoid duplicates
            if (result.shapeIds && result.shapeIds.length > 0) {
              // Track created shapes for createShape and createMultipleShapes
              if (
                toolCall.name === "createShape" ||
                toolCall.name === "createMultipleShapes"
              ) {
                shapesCreated.push(...result.shapeIds);
              }
              shapesAffected.push(...result.shapeIds);
            } else if (result.shapeId) {
              // Fallback to single shapeId (for tools that don't return shapeIds array)
              if (
                toolCall.name === "createShape" ||
                toolCall.name === "createMultipleShapes"
              ) {
                shapesCreated.push(result.shapeId);
              }
              shapesAffected.push(result.shapeId);
            }
          }
        }

        // Append to AI history within same transaction
        const aiHistory = this.doc.getArray("aiHistory");

        // Build a better response message
        let responseMessage = "";
        if (shapesCreated.length > 0) {
          responseMessage = `Created ${shapesCreated.length} shape${shapesCreated.length > 1 ? "s" : ""}`;
        } else if (toolResults.length > 0) {
          responseMessage = toolResults.map((r) => r.message).join("; ");
        } else {
          responseMessage = "No operations performed";
        }

        const historyEntry = {
          id: commandId,
          userId,
          userName,
          prompt,
          response: responseMessage,
          timestamp: Date.now(),
          shapesAffected,
          success: toolResults.every((r) => r.success),
          error: toolResults.find((r) => !r.success)?.error,
        };

        aiHistory.push([historyEntry]);

        // Prune history to last 100 entries
        if (aiHistory.length > 100) {
          aiHistory.delete(0, aiHistory.length - 100);
        }
      });

      const result: AICommandResult = {
        success: true,
        message: `Executed ${toolCalls.length} AI tools successfully`,
        shapesCreated,
        shapesAffected,
        commandId,
      };

      // Cache result for idempotency
      this.commandCache.set(commandId, {
        commandId,
        result,
        timestamp: Date.now(),
      });

      // Clean old cache entries (keep last 50) - O(1) using Map iteration order
      if (this.commandCache.size > 50) {
        // Maps maintain insertion order, so delete oldest entries
        const entriesToDelete = this.commandCache.size - 50;
        let deleted = 0;
        for (const [key] of this.commandCache) {
          if (deleted >= entriesToDelete) break;
          this.commandCache.delete(key);
          deleted++;
        }
      }

      return result;
    } catch (error) {
      console.error("[RoomDO] ✗ executeAICommand error:", error);
      console.error(
        "[RoomDO] Error stack:",
        error instanceof Error ? error.stack : "No stack",
      );
      const result: AICommandResult = {
        success: false,
        message: "Failed to execute AI command",
        error: error instanceof Error ? error.message : "Unknown error",
        commandId,
      };
      this.commandCache.set(commandId, {
        commandId,
        result,
        timestamp: Date.now(),
      });
      return result;
    }
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
