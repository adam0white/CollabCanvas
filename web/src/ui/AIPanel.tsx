/**
 * AIPanel Component - AI command interface with history
 *
 * Features:
 * - Text input for AI prompts
 * - Loading state with animated indicator
 * - Error display
 * - History panel showing all AI interactions
 * - Guest users see history but cannot send commands
 * - Context-aware: gathers selected shapes, viewport, and canvas stats
 */

import { useUser } from "@clerk/clerk-react";
import React, { useCallback, useRef, useState } from "react";
import { useAI } from "../hooks/useAI";
import { useSelection } from "../hooks/useSelection";
import { useShapes } from "../shapes/useShapes";
import styles from "./AIPanel.module.css";

type AIPanelProps = {
  canvasViewport?: {
    center: { x: number; y: number };
    bounds: { x: number; y: number; width: number; height: number };
  };
};

export const AIPanel = React.forwardRef<HTMLTextAreaElement, AIPanelProps>(
  function AIPanel({ canvasViewport }, ref): React.JSX.Element {
    const { history, isLoading, error, sendCommand, canUseAI } = useAI();
    const { user } = useUser();
    const [prompt, setPrompt] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { selectedShapeIds } = useSelection();
    const { shapes } = useShapes();

    // Merge external ref with internal ref
    React.useImperativeHandle(
      ref,
      () => textareaRef.current as HTMLTextAreaElement,
    );

    // Get current user ID for highlighting their commands
    const currentUserId = user?.id ?? null;

    const handleSubmit = useCallback(
      async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) return;

        try {
          // Gather canvas context for AI
          const selectedShapes = shapes
            .filter((s) => selectedShapeIds.includes(s.id))
            .map((s) => ({
              id: s.id,
              type: s.type,
              x: s.x,
              y: s.y,
              ...(s.type === "rectangle" && {
                width: (s as { width: number }).width,
                height: (s as { height: number }).height,
              }),
              ...(s.type === "circle" && {
                radius: (s as { radius: number }).radius,
              }),
              ...(s.type === "text" && {
                text: (s as { text: string }).text,
              }),
              fill: s.fill,
            }));

          // Calculate canvas statistics
          const shapeTypes: Record<string, number> = {};
          for (const shape of shapes) {
            shapeTypes[shape.type] = (shapeTypes[shape.type] || 0) + 1;
          }

          const context = {
            selectedShapeIds,
            selectedShapes,
            viewportCenter: canvasViewport?.center ?? { x: 1000, y: 1000 },
            viewportBounds: canvasViewport?.bounds ?? {
              x: 0,
              y: 0,
              width: 2000,
              height: 2000,
            },
            canvasStats: {
              totalShapes: shapes.length,
              shapeTypes,
              visibleShapes: shapes.length, // TODO: Calculate actual visible shapes
            },
          };

          await sendCommand(trimmedPrompt, context);
          setPrompt(""); // Clear input on success
        } catch {
          // Error is already handled by useAI hook
        }
      },
      [prompt, sendCommand, selectedShapeIds, shapes, canvasViewport],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (without Shift)
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit(e);
        }
      },
      [handleSubmit],
    );

    return (
      <div className={styles.panel}>
        {/* Input Section */}
        <div className={styles.inputSection}>
          <h3 className={styles.title}>AI Assistant</h3>
          <form onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                canUseAI
                  ? "Ask AI to create, move, or modify shapes..."
                  : "Sign in to use AI commands"
              }
              disabled={!canUseAI || isLoading}
              rows={3}
            />
            <button
              type="submit"
              className={styles.submitButton}
              disabled={!canUseAI || isLoading || !prompt.trim()}
              title={canUseAI ? "Send command" : "Sign in to use AI"}
            >
              {isLoading ? (
                <>
                  <span className={styles.loadingDots}>AI is thinking</span>
                  <span className={styles.loadingAnimation}>...</span>
                </>
              ) : (
                "Send"
              )}
            </button>
          </form>

          {/* Error Display */}
          {error && <div className={styles.error}>{error}</div>}
        </div>

        {/* History Section */}
        <div className={styles.historySection}>
          <h4 className={styles.historyTitle}>
            History {history.length > 0 && `(${history.length})`}
          </h4>
          <div className={styles.historyList}>
            {history.length === 0 ? (
              <div className={styles.emptyState}>
                No AI commands yet. Try asking the AI to create shapes!
              </div>
            ) : (
              history.map((entry) => {
                const isCurrentUser = entry.userId === currentUserId;
                return (
                  <div
                    key={entry.id}
                    className={`${styles.historyEntry} ${
                      entry.success ? styles.success : styles.failed
                    } ${isCurrentUser ? styles.currentUser : ""}`}
                  >
                    <div className={styles.historyHeader}>
                      <span className={styles.userName}>
                        {isCurrentUser ? "You" : entry.userName}
                      </span>
                      <span className={styles.timestamp}>
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <div className={styles.prompt}>{entry.prompt}</div>
                    <div className={styles.response}>
                      {entry.success ? "✓" : "✗"} {entry.response}
                    </div>
                    {entry.shapesAffected.length > 0 && (
                      <div className={styles.shapesAffected}>
                        {entry.shapesAffected.length} shape(s) affected
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  },
);

/**
 * Format timestamp as relative time (e.g., "2m ago")
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 5) return `${seconds}s ago`;
  return "just now";
}
