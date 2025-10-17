/**
 * useUndoRedo - Manages undo/redo functionality with Yjs UndoManager
 * 
 * Features:
 * - Local-only undo/redo (only undoes user's own changes)
 * - Tracks shapes Y.Map
 * - Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)
 * - Provides canUndo/canRedo state for UI
 */

import { useEffect, useRef, useState } from "react";
import { UndoManager } from "yjs";
import { useYDoc } from "../yjs/client";

export type UndoRedoHook = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

export function useUndoRedo(): UndoRedoHook {
  const doc = useYDoc();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoManagerRef = useRef<UndoManager | null>(null);

  // Initialize UndoManager
  useEffect(() => {
    const shapesMap = doc.getMap("shapes");
    
    // Create UndoManager tracking the shapes map
    const undoManager = new UndoManager(shapesMap, {
      // Track only local changes (don't undo other users' changes)
      trackedOrigins: new Set([doc.clientID]),
      // Capture timeout: group rapid changes within 500ms as single undo step
      captureTimeout: 500,
    });

    undoManagerRef.current = undoManager;

    // Update UI state when undo/redo stack changes
    const updateState = () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    };

    // Listen to stack changes
    undoManager.on("stack-item-added", updateState);
    undoManager.on("stack-item-popped", updateState);
    undoManager.on("stack-cleared", updateState);

    // Initial state
    updateState();

    return () => {
      // Cleanup
      undoManager.off("stack-item-added", updateState);
      undoManager.off("stack-item-popped", updateState);
      undoManager.off("stack-cleared", updateState);
      undoManager.destroy();
      undoManagerRef.current = null;
    };
  }, [doc]);

  const undo = () => {
    if (undoManagerRef.current) {
      undoManagerRef.current.undo();
    }
  };

  const redo = () => {
    if (undoManagerRef.current) {
      undoManagerRef.current.redo();
    }
  };

  return {
    canUndo,
    canRedo,
    undo,
    redo,
  };
}
