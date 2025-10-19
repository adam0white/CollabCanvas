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
import { AI } from "../config/constants";
import { useYDoc } from "../yjs/client";

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
};

export function useAI(): UseAIReturn {
  const doc = useYDoc();
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
    [isSignedIn, getToken, user],
  );

  return {
    history,
    isLoading,
    error,
    sendCommand,
    canUseAI: !!isSignedIn,
  };
}
