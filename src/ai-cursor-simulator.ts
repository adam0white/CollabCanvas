/**
 * AI Cursor Simulator - Theatrical AI execution with visual feedback
 *
 * This module handles the "slow" execution of AI tool calls with cursor
 * movement and progress updates via Yjs Awareness.
 *
 * Architecture:
 * - AI generates tool calls instantly (as before)
 * - Simulator intercepts execution and runs tools slowly
 * - Creates virtual "AI Agent" cursor in Awareness
 * - Moves cursor to each operation location before executing
 * - Updates progress indicators in real-time
 * - All users see the AI working
 *
 * Timing Strategy:
 * - Creating shapes: ~300ms each
 * - Moving shapes: ~200ms per shape
 * - Style changes: ~150ms per shape
 * - Complex operations (grid): stagger creation by row
 * - Total time budget: aim for 5-10s max for complex commands
 * - Balance: fast enough to not be annoying, slow enough to be visible
 */

import type { Doc } from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { dispatchTool, type ToolCall, type ToolResult } from "./ai-tools";

/**
 * Timing configuration for different operations (in milliseconds)
 */
const TIMING = {
  CURSOR_MOVE: 100, // Time to move cursor between operations
  SHAPE_CREATE: 300, // Time to create a single shape
  SHAPE_MOVE: 200, // Time to move a shape
  SHAPE_STYLE: 150, // Time to update shape style
  SHAPE_DELETE: 100, // Time to delete a shape
  PATTERN_STAGGER: 50, // Delay between shapes in pattern creation (reduced for performance)
  THINKING: 50, // Brief "thinking" pause before operation
} as const;

/**
 * Result of simulated execution
 */
export type SimulatedExecutionResult = {
  success: boolean;
  toolResults: ToolResult[];
  shapesCreated: string[];
  shapesAffected: string[];
  errors: string[];
};

/**
 * Execute AI tool calls with simulated cursor movement and delays
 *
 * This function creates a theatrical effect where users see the AI agent
 * working in real-time. It:
 * 1. Creates an AI agent cursor in Awareness
 * 2. Executes tool calls one by one with delays
 * 3. Moves the cursor to relevant positions
 * 4. Updates progress indicators
 * 5. Removes the cursor when done
 *
 * @param doc - Yjs document for shape operations
 * @param awareness - Yjs Awareness for cursor broadcasting
 * @param toolCalls - Array of tool calls to execute
 * @param userId - User ID who triggered the AI
 * @param userName - Display name of the user
 * @returns Execution result with all tool results
 */
export async function executeWithSimulation(
  doc: Doc,
  awareness: Awareness,
  toolCalls: ToolCall[],
  userId: string,
  userName: string,
): Promise<SimulatedExecutionResult> {
  const shapesCreated: string[] = [];
  const shapesAffected: string[] = [];
  const toolResults: ToolResult[] = [];
  const errors: string[] = [];

  // Generate unique AI agent client ID
  const aiAgentId = `ai-agent-${userId}-${Date.now()}`;
  const aiClientId = Math.floor(Math.random() * 1000000000);

  try {
    // Create AI agent cursor in Awareness
    const agentState = {
      presence: {
        userId: aiAgentId,
        displayName: userName,
        color: "#8b5cf6", // Purple for AI
        cursor: { x: 1000, y: 1000 }, // Start at canvas center
        isAIAgent: true,
        aiAgentOwner: userId,
        aiProgress: {
          current: 0,
          total: toolCalls.length,
          message: "Starting...",
        },
      },
    };

    // Manually set awareness state for AI agent
    // We simulate a client by using awareness's internal state map
    awareness.setLocalStateField("aiAgent", agentState);

    // Small delay to ensure awareness update is broadcast
    await sleep(100);

    // Execute each tool call with simulation
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];

      // Update progress
      agentState.presence.aiProgress = {
        current: i + 1,
        total: toolCalls.length,
        message: getOperationMessage(toolCall.name),
      };
      awareness.setLocalStateField("aiAgent", agentState);

      // Calculate target position for cursor movement
      const targetPosition = getOperationPosition(toolCall);
      if (targetPosition) {
        // Move cursor to operation position
        agentState.presence.cursor = targetPosition;
        awareness.setLocalStateField("aiAgent", agentState);
        await sleep(TIMING.CURSOR_MOVE);

        // Brief "thinking" pause
        await sleep(TIMING.THINKING);
      }

      // Execute the tool within a Yjs transaction
      let result: ToolResult;
      doc.transact(() => {
        result = dispatchTool(doc, toolCall, userId);
      });

      // Wait for simulated execution time
      const delay = getOperationDelay(toolCall);
      await sleep(delay);

      // Store result
      toolResults.push(result!);

      if (result!.success) {
        // Track created and affected shapes
        if (result!.shapeIds && result!.shapeIds.length > 0) {
          if (
            toolCall.name === "createShape" ||
            toolCall.name === "createPattern"
          ) {
            shapesCreated.push(...result!.shapeIds);
          }
          shapesAffected.push(...result!.shapeIds);
        } else if (result!.shapeId) {
          if (
            toolCall.name === "createShape" ||
            toolCall.name === "createPattern"
          ) {
            shapesCreated.push(result!.shapeId);
          }
          shapesAffected.push(result!.shapeId);
        }
      } else {
        errors.push(result!.message);
      }
    }

    // Final progress update
    agentState.presence.aiProgress = {
      current: toolCalls.length,
      total: toolCalls.length,
      message: "Complete!",
    };
    awareness.setLocalStateField("aiAgent", agentState);
    await sleep(500); // Brief pause to show completion

    return {
      success: toolResults.every((r) => r.success),
      toolResults,
      shapesCreated,
      shapesAffected,
      errors,
    };
  } finally {
    // Remove AI agent cursor from Awareness
    awareness.setLocalStateField("aiAgent", null);
  }
}

/**
 * Get human-readable message for operation type
 */
function getOperationMessage(toolName: string): string {
  const messages: Record<string, string> = {
    createShape: "Creating shapes",
    createPattern: "Creating pattern",
    moveShape: "Moving shape",
    resizeShape: "Resizing shape",
    rotateShape: "Rotating shape",
    updateShapeStyle: "Updating style",
    deleteShape: "Deleting shape",
    arrangeShapes: "Arranging shapes",
    findShapes: "Finding shapes",
  };
  return messages[toolName] || "Working";
}

/**
 * Get target position for cursor movement based on tool operation
 */
function getOperationPosition(
  toolCall: ToolCall,
): { x: number; y: number } | null {
  const params = toolCall.parameters;

  // For shape creation, move to the first shape's position
  if (toolCall.name === "createShape" && "shapes" in params) {
    const shapes = params.shapes as Array<{ x?: number; y?: number }>;
    if (shapes && shapes.length > 0 && shapes[0].x && shapes[0].y) {
      return { x: shapes[0].x, y: shapes[0].y };
    }
  }

  // For pattern creation, move to the start position
  if (toolCall.name === "createPattern") {
    const startX = params.startX as number | undefined;
    const startY = params.startY as number | undefined;
    if (startX !== undefined && startY !== undefined) {
      return { x: startX, y: startY };
    }
  }

  // For single-shape operations, use the shape's position (if available)
  // Note: We'd need to query the doc to get the shape's position, which is expensive
  // For now, just return null and keep cursor at current position

  return null;
}

/**
 * Calculate delay for operation based on its complexity
 */
function getOperationDelay(toolCall: ToolCall): number {
  const params = toolCall.parameters;

  switch (toolCall.name) {
    case "createShape": {
      // Delay based on number of shapes being created
      const shapes = params.shapes as unknown[];
      const count = Array.isArray(shapes) ? shapes.length : 1;
      // For multiple shapes, use staggered delay (diminishing returns)
      return TIMING.SHAPE_CREATE + Math.min(count - 1, 10) * TIMING.PATTERN_STAGGER;
    }

    case "createPattern": {
      // Delay based on pattern size
      const count =
        (params.count as number) ??
        ((params.rows as number) ?? 1) * ((params.columns as number) ?? 1);
      // Cap at reasonable time for large patterns
      return TIMING.SHAPE_CREATE + Math.min(count - 1, 20) * TIMING.PATTERN_STAGGER;
    }

    case "moveShape":
      return TIMING.SHAPE_MOVE;

    case "updateShapeStyle":
      return TIMING.SHAPE_STYLE;

    case "deleteShape":
      return TIMING.SHAPE_DELETE;

    case "arrangeShapes": {
      // Delay based on number of shapes being arranged
      const shapeIds = params.shapeIds as string[] | undefined;
      const count = shapeIds ? shapeIds.length : 1;
      return TIMING.SHAPE_MOVE * Math.min(count, 5); // Cap at 5x delay
    }

    default:
      return TIMING.SHAPE_MOVE; // Default delay
  }
}

/**
 * Sleep utility for async delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
