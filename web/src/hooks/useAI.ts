/**
 * useAI Hook - Manages AI command execution and history
 *
 * Features:
 * - Send AI commands to backend
 * - Track loading state and errors
 * - Observe AI history from Yjs
 * - Real-time updates for all users
 */

import { useAuth, useUser } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";
import { AI, AI_AGENT } from "../config/constants";
import { useAwareness, useYDoc } from "../yjs/client";
import type { PresenceState } from "./usePresence";

export type AIHistoryEntry = {
  id: string;
  userId: string;
  userName: string;
  prompt: string;
  response: string;
  timestamp: number;
  shapesAffected: string[];
  success: boolean;
  error?: string;
};

export type AICommandResult = {
  success: boolean;
  message: string;
  shapesCreated?: string[];
  shapesAffected?: string[];
  error?: string;
  commandId: string;
  toolCalls?: Array<{ name: string; params: Record<string, unknown> }>;
};

type UseAIReturn = {
  history: AIHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  sendCommand: (prompt: string, context?: AIContext) => Promise<void>;
  canUseAI: boolean;
};

type AIContext = {
  selectedShapeIds?: string[];
  viewportCenter?: { x: number; y: number };
  viewportBounds?: { x: number; y: number; width: number; height: number };
  canvasScale?: number;
  selectedShapes?: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    fill?: string;
  }>;
  nearbyShapes?: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
  }>;
  canvasStats?: {
    totalShapes: number;
    shapeTypes: Record<string, number>;
  };
};

export function useAI(): UseAIReturn {
  const doc = useYDoc();
  const awareness = useAwareness();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [history, setHistory] = useState<AIHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to AI history changes from Yjs
  useEffect(() => {
    const aiHistory = doc.getArray("aiHistory");

    const updateHistory = () => {
      const entries: AIHistoryEntry[] = [];
      for (let i = 0; i < aiHistory.length; i++) {
        const entry = aiHistory.get(i);
        if (entry && typeof entry === "object") {
          entries.push(entry as AIHistoryEntry);
        }
      }
      // Sort by timestamp descending (newest first)
      entries.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(entries);
    };

    aiHistory.observe(updateHistory);
    updateHistory(); // Initial load

    return () => {
      aiHistory.unobserve(updateHistory);
    };
  }, [doc]);

  const sendCommand = useCallback(
    async (prompt: string, context?: AIContext) => {
      if (!isSignedIn) {
        setError("You must be signed in to use AI commands");
        return;
      }

      // Clear previous error
      setError(null);
      setIsLoading(true);

      try {
        // Get auth token
        const token = await getToken();
        if (!token) {
          throw new Error("Failed to get authentication token");
        }

        // Validate prompt length
        if (prompt.length > AI.MAX_PROMPT_LENGTH) {
          throw new Error(
            `Prompt too long. Maximum ${AI.MAX_PROMPT_LENGTH} characters.`,
          );
        }

        // Determine room ID (default to "main")
        const roomId =
          new URL(window.location.href).searchParams.get("roomId") ?? "main";

        // Get user's display name (same logic as usePresence)
        const userName =
          user?.fullName ||
          user?.username ||
          user?.primaryEmailAddress?.emailAddress ||
          "User";

        // Send command to backend
        const response = await fetch(`/c/${roomId}/ai-command`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt,
            context,
            userName,
          }),
          signal: AbortSignal.timeout(AI.COMMAND_TIMEOUT_MS),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `HTTP error ${response.status}: ${response.statusText}`,
          );
        }

        const result: AICommandResult = await response.json();

        if (!result.success) {
          throw new Error(result.error || result.message);
        }

        // Simulate AI cursor movement if toolCalls are provided
        if (result.toolCalls && result.toolCalls.length > 0) {
          await simulateAIExecution(
            result.toolCalls,
            awareness,
            user?.id || "unknown",
            userName,
            doc,
          );
        }

        // Success - history will be updated via Yjs observation
      } catch (err) {
        console.error("[AI] Command error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isSignedIn, getToken, user, awareness, doc],
  );

  return {
    history,
    isLoading,
    error,
    sendCommand,
    canUseAI: !!isSignedIn,
  };
}

/**
 * Helper function to calculate cursor position for a tool call
 */
function calculateCursorPosition(
  toolCall: { name: string; params: Record<string, unknown> },
  doc: any,
): { x: number; y: number } {
  const params = toolCall.params;

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
      if (shape && typeof shape === "object" && "x" in shape && "y" in shape) {
        return { x: shape.x as number, y: shape.y as number };
      }
    }
  }

  // Default: canvas center
  return { x: 1000, y: 1000 };
}

/**
 * Helper function to calculate delay for a tool operation
 */
function getDelayForTool(toolCall: {
  name: string;
  params: Record<string, unknown>;
}): number {
  const params = toolCall.params;

  // Pattern creation: longer delay for many shapes
  if (toolCall.name === "createPattern") {
    const count =
      (params.count as number) ??
      ((params.rows as number) ?? 1) * ((params.columns as number) ?? 1);
    return Math.min(
      AI_AGENT.PATTERN_BASE_DELAY + count * AI_AGENT.PATTERN_PER_SHAPE_DELAY,
      AI_AGENT.PATTERN_MAX_DELAY,
    );
  }

  // Shape creation: delay based on number of shapes
  if (toolCall.name === "createShape" && "shapes" in params) {
    const count = Array.isArray(params.shapes) ? params.shapes.length : 1;
    return Math.min(
      AI_AGENT.SHAPE_BASE_DELAY + count * AI_AGENT.SHAPE_PER_SHAPE_DELAY,
      AI_AGENT.SHAPE_MAX_DELAY,
    );
  }

  // Arrange operations: longer delay for many shapes
  if (toolCall.name === "arrangeShapes" && "shapeIds" in params) {
    const count = Array.isArray(params.shapeIds) ? params.shapeIds.length : 0;
    return Math.min(
      AI_AGENT.ARRANGE_BASE_DELAY + count * AI_AGENT.ARRANGE_PER_SHAPE_DELAY,
      AI_AGENT.ARRANGE_MAX_DELAY,
    );
  }

  // Default delays for other operations
  const defaultDelays: Record<string, number> = {
    updateShapeStyle: AI_AGENT.STYLE_UPDATE_DELAY,
    moveShape: AI_AGENT.MOVE_DELAY,
    deleteShape: AI_AGENT.DELETE_DELAY,
    rotateShape: AI_AGENT.ROTATE_DELAY,
    resizeShape: AI_AGENT.RESIZE_DELAY,
  };

  return defaultDelays[toolCall.name] ?? 150; // Default 150ms
}

/**
 * Simulate AI agent cursor movement and execution
 * This creates a theatrical effect where the cursor moves to each shape
 * position before/after it's created, with delays for visual feedback
 */
async function simulateAIExecution(
  toolCalls: Array<{ name: string; params: Record<string, unknown> }>,
  awareness: any,
  userId: string,
  userName: string,
  doc: any,
): Promise<void> {
  console.log(
    "[AI] Starting cursor simulation for",
    toolCalls.length,
    "operations",
  );

  // Store original presence state to restore later
  const originalState = awareness.getLocalState();

  // Set AI agent cursor in local awareness
  const agentState: PresenceState = {
    userId: `ai-agent-${userId}`,
    displayName: `🤖 Agent by ${userName}`,
    color: AI_AGENT.COLOR,
    cursor: { x: 1000, y: 1000 }, // Start at canvas center
    isAIAgent: true,
    aiAgentOwner: userId,
    aiAgentStatus: "thinking",
  };

  awareness.setLocalState({ presence: agentState });

  try {
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];

      console.log(
        `[AI] Simulating tool ${i + 1}/${toolCalls.length}: ${toolCall.name}`,
      );

      // Calculate cursor position for this tool
      const cursorPos = calculateCursorPosition(toolCall, doc);

      // Move cursor to position
      agentState.cursor = cursorPos;
      agentState.aiAgentStatus = "working";
      awareness.setLocalState({ presence: agentState });

      // Wait for theatrical delay
      const delay = getDelayForTool(toolCall);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Small delay between operations for visual separation
      if (i < toolCalls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  } finally {
    // Remove AI agent cursor by restoring original state
    console.log("[AI] Cursor simulation complete, removing AI cursor");
    awareness.setLocalState(originalState);
  }
}
