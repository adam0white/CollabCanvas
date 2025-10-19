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
import {
  createEncoder,
  toUint8Array,
  writeVarUint,
  writeVarUint8Array,
} from "lib0/encoding";
import { YDurableObjects } from "y-durableobjects";
import type { Awareness } from "y-protocols/awareness";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
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

    // Performance: Only schedule commits on actual updates
    // Debouncing already implemented, but this ensures we don't schedule unnecessarily
    let updatePending = false;

    this.awareness.on("update", () => {
      if (!updatePending) {
        updatePending = true;
        this.commitScheduler.schedule();
        // Reset flag after a tick to allow batching
        queueMicrotask(() => {
          updatePending = false;
        });
      }
    });

    this.doc.on("update", () => {
      if (!updatePending) {
        updatePending = true;
        this.commitScheduler.schedule();
        queueMicrotask(() => {
          updatePending = false;
        });
      }
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
  /**
   * RPC Method: Execute AI Command with Simulated Execution
   *
   * Features:
   * - Creates AI agent cursor in Awareness
   * - Executes tool calls slowly with delays (theatrical effect)
   * - Moves cursor between operations
   * - Shows visual feedback to all users
   * - Idempotency via in-memory cache
   */
  async executeAICommand(params: {
    commandId: string;
    toolCalls: ToolCall[];
    userId: string;
    userName: string;
    prompt: string;
  }): Promise<AICommandResult> {
    const { commandId, toolCalls, userId, userName, prompt } = params;

    // Performance: Idempotency check in memory (no storage I/O)
    const cached = this.commandCache.get(commandId);
    if (cached) {
      return cached.result;
    }

    // Validate bounds: With viewport culling and batching, we can handle much larger operations
    // Increased from 50 to 1000 shapes per command thanks to performance optimizations
    const MAX_SHAPES = 1000;

    // Count total shapes being created across all tool calls
    let totalShapesToCreate = 0;
    for (const toolCall of toolCalls) {
      if (
        toolCall.name === "createShape" ||
        toolCall.name === "createPattern"
      ) {
        if (
          toolCall.name === "createShape" &&
          "shapes" in toolCall.parameters
        ) {
          const shapes = toolCall.parameters.shapes as unknown[];
          totalShapesToCreate += Array.isArray(shapes) ? shapes.length : 1;
        } else if (toolCall.name === "createPattern") {
          const params = toolCall.parameters as {
            count?: number;
            rows?: number;
            columns?: number;
          };
          const count =
            params.count ?? (params.rows ?? 1) * (params.columns ?? 1);
          totalShapesToCreate += count;
        }
      }
    }

    if (totalShapesToCreate > MAX_SHAPES) {
      const result: AICommandResult = {
        success: false,
        message: `Too many shapes requested: ${totalShapesToCreate}. Maximum is ${MAX_SHAPES} per command.`,
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
      // Create AI agent cursor in Awareness
      // Use deterministic client ID for AI agent so it appears as a separate "user"
      const agentClientId = Math.abs(
        Array.from(userId).reduce((acc, c) => acc + c.charCodeAt(0), 0) %
          1000000,
      ) + 1000000; // Large positive ID to avoid collision

      const agentPresence = {
        userId: `ai-agent-${userId}`,
        displayName: `🤖 Agent by ${userName}`,
        color: "#9333ea", // Purple color for AI agent
        cursor: { x: 1000, y: 1000 }, // Start at canvas center
        isAIAgent: true,
        aiAgentOwner: userId,
        aiAgentStatus: "thinking" as "thinking" | "working" | "idle",
      };

      // Manually inject AI agent state into awareness and broadcast
      // We can't use setLocalState because that only affects the DO's own client ID
      this.setAwarenessState(agentClientId, { presence: agentPresence });

      const shapesCreated: string[] = [];
      const shapesAffected: string[] = [];
      const toolResults: ToolResult[] = [];

      // Execute tools one by one with delays (simulated execution)
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];

        // Calculate cursor position based on tool operation
        const cursorPos = this.calculateCursorPosition(toolCall, this.doc);

        // Update AI agent status to "working" and move cursor
        agentPresence.aiAgentStatus = "working";
        agentPresence.cursor = cursorPos;
        this.setAwarenessState(agentClientId, { presence: agentPresence });

        // Delay before executing (simulate "thinking" time)
        await this.sleep(this.getDelayForTool(toolCall));

        // Execute the tool
        const result = dispatchTool(this.doc, toolCall, userId);
        toolResults.push(result);

        if (result.success) {
          // Prefer shapeIds array over single shapeId to avoid duplicates
          if (result.shapeIds && result.shapeIds.length > 0) {
            // Track created shapes for createShape and createMultipleShapes
            if (
              toolCall.name === "createShape" ||
              toolCall.name === "createMultipleShapes" ||
              toolCall.name === "createPattern"
            ) {
              shapesCreated.push(...result.shapeIds);
            }
            shapesAffected.push(...result.shapeIds);
          } else if (result.shapeId) {
            // Fallback to single shapeId (for tools that don't return shapeIds array)
            if (
              toolCall.name === "createShape" ||
              toolCall.name === "createMultipleShapes" ||
              toolCall.name === "createPattern"
            ) {
              shapesCreated.push(result.shapeId);
            }
            shapesAffected.push(result.shapeId);
          }
        }

        // Small delay after each operation for visual effect
        await this.sleep(50);
      }

      // Remove AI agent cursor by setting state to null
      this.setAwarenessState(agentClientId, null);

      // Append to AI history
      this.doc.transact(() => {
        const aiHistory = this.doc.getArray("aiHistory");

        // Build concise response message
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

        // Performance: Efficient history pruning (delete range vs multiple deletes)
        // Keep last 50 entries (reduced from 100 to save memory)
        const MAX_HISTORY_ENTRIES = 50;
        if (aiHistory.length > MAX_HISTORY_ENTRIES) {
          const toDelete = aiHistory.length - MAX_HISTORY_ENTRIES;
          aiHistory.delete(0, toDelete);
        }
      });

      const result: AICommandResult = {
        success: true,
        message: `Executed ${toolCalls.length} AI tools successfully`,
        shapesCreated,
        shapesAffected,
        commandId,
      };

      // Performance: Cache result in memory for idempotency (no storage I/O)
      this.commandCache.set(commandId, {
        commandId,
        result,
        timestamp: Date.now(),
      });

      // Performance: LRU cache cleanup - O(n) but only runs when cache is full
      // Maps maintain insertion order, so oldest entries are first
      const MAX_CACHE_SIZE = 50;
      if (this.commandCache.size > MAX_CACHE_SIZE) {
        const toDelete = this.commandCache.size - MAX_CACHE_SIZE;
        let deleted = 0;
        for (const [key] of this.commandCache) {
          if (deleted >= toDelete) break;
          this.commandCache.delete(key);
          deleted++;
        }
      }

      return result;
    } catch (error) {
      // Make sure to remove AI agent cursor on error
      // Use a fallback client ID in case agentClientId is not in scope
      const fallbackAgentClientId = Math.abs(
        Array.from(userId).reduce((acc, c) => acc + c.charCodeAt(0), 0) %
          1000000,
      ) + 1000000;
      this.setAwarenessState(fallbackAgentClientId, null);

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

  /**
   * Calculate cursor position based on tool operation
   * Moves cursor to relevant location for visual feedback
   */
  private calculateCursorPosition(
    toolCall: ToolCall,
    // biome-ignore lint/suspicious/noExplicitAny: Yjs types are complex
    doc: any,
  ): { x: number; y: number } {
    const params = toolCall.parameters;

    // For shape creation, move to the first shape's position
    if (toolCall.name === "createShape" && "shapes" in params) {
      const shapes = params.shapes as Array<{ x?: number; y?: number }>;
      if (shapes.length > 0 && shapes[0].x != null && shapes[0].y != null) {
        return { x: shapes[0].x, y: shapes[0].y };
      }
    }

    // For pattern creation, move to start position
    if (toolCall.name === "createPattern") {
      const startX = params.startX as number | undefined;
      const startY = params.startY as number | undefined;
      if (startX !== undefined && startY !== undefined) {
        return { x: startX, y: startY };
      }
    }

    // For move/update/delete operations, move to shape's position
    if (
      (toolCall.name === "moveShape" ||
        toolCall.name === "updateShapeStyle" ||
        toolCall.name === "deleteShape") &&
      "shapeId" in params
    ) {
      const shapesMap = doc.getMap("shapes");
      const shape = shapesMap.get(params.shapeId as string);
      if (shape && typeof shape === "object" && "x" in shape && "y" in shape) {
        return { x: shape.x as number, y: shape.y as number };
      }
    }

    // For arrange operations, move to first shape
    if (toolCall.name === "arrangeShapes" && "shapeIds" in params) {
      const shapeIds = params.shapeIds as string[];
      if (shapeIds.length > 0) {
        const shapesMap = doc.getMap("shapes");
        const shape = shapesMap.get(shapeIds[0]);
        if (
          shape &&
          typeof shape === "object" &&
          "x" in shape &&
          "y" in shape
        ) {
          return { x: shape.x as number, y: shape.y as number };
        }
      }
    }

    // Default: canvas center
    return { x: 1000, y: 1000 };
  }

  /**
   * Calculate delay for a tool operation
   * More complex operations get longer delays for better visual feedback
   */
  private getDelayForTool(toolCall: ToolCall): number {
    const params = toolCall.parameters;

    // Pattern creation: longer delay for many shapes
    if (toolCall.name === "createPattern") {
      const count =
        (params.count as number) ??
        ((params.rows as number) ?? 1) * ((params.columns as number) ?? 1);
      // Base 200ms + 10ms per shape, capped at 1000ms
      return Math.min(200 + count * 10, 1000);
    }

    // Shape creation: delay based on number of shapes
    if (toolCall.name === "createShape" && "shapes" in params) {
      const count = Array.isArray(params.shapes) ? params.shapes.length : 1;
      // Base 150ms + 20ms per shape, capped at 800ms
      return Math.min(150 + count * 20, 800);
    }

    // Arrange operations: longer delay for many shapes
    if (toolCall.name === "arrangeShapes" && "shapeIds" in params) {
      const count = Array.isArray(params.shapeIds) ? params.shapeIds.length : 0;
      return Math.min(150 + count * 15, 600);
    }

    // Style updates: short delay
    if (toolCall.name === "updateShapeStyle") {
      return 100;
    }

    // Default delays for other operations
    return {
      moveShape: 150,
      deleteShape: 120,
      findShapes: 100,
      rotateShape: 120,
      resizeShape: 150,
    }[toolCall.name] ?? 150;
  }

  /**
   * Sleep utility for simulated delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set awareness state for a specific client ID and broadcast to all connected clients
   * This is used to create "virtual" clients like AI agents that appear in awareness
   * 
   * @param clientId - The client ID to set state for
   * @param state - The state object, or null to remove the client
   */
  private setAwarenessState(
    clientId: number,
    state: Record<string, unknown> | null,
  ): void {
    // Directly manipulate awareness states
    if (state === null) {
      // Remove the client state
      this.awareness.states.delete(clientId);
      this.awareness.meta.delete(clientId);
    } else {
      // Set the client state
      this.awareness.states.set(clientId, state);
      // Update meta with current timestamp and clock
      const existingMeta = this.awareness.meta.get(clientId);
      this.awareness.meta.set(clientId, {
        clock: (existingMeta?.clock ?? 0) + 1,
        lastUpdated: Date.now(),
      });
    }

    // Encode and broadcast the awareness update
    const update = encodeAwarenessUpdate(this.awareness, [clientId]);

    // Broadcast to all connected clients via WebSocket
    // We need to wrap it in the Yjs message format (MessageType.Awareness = 1)
    const encoder = createEncoder();
    writeVarUint(encoder, 1); // MessageType.Awareness
    writeVarUint8Array(encoder, update);

    const message = toUint8Array(encoder);

    // Broadcast to all connected sockets
    for (const ws of this.sockets) {
      try {
        ws.send(message);
      } catch (error) {
        console.error("[RoomDO] Failed to send awareness update:", error);
      }
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
