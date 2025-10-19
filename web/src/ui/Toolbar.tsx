import { useAuth } from "@clerk/clerk-react";
import clsx from "clsx";
import { useState } from "react";
import { useSelection } from "../hooks/useSelection";
import type { GridSize } from "../hooks/useSnapToGrid";
import { useSnapToGrid } from "../hooks/useSnapToGrid";
import { useToolbar } from "../hooks/useToolbar";
import { useUndoRedo } from "../hooks/useUndoRedo";
import {
  alignBottom,
  alignCenter,
  alignLeft,
  alignMiddle,
  alignRight,
  alignTop,
  distributeHorizontally,
  distributeVertically,
  getAvailableAlignmentOperations,
} from "../shapes/alignment";
import { useShapes } from "../shapes/useShapes";
import {
  bringForward,
  bringToFront,
  getAvailableZIndexOperations,
  sendBackward,
  sendToBack,
} from "../shapes/zindex";
import { ColorPicker } from "./ColorPicker";
import styles from "./Toolbar.module.css";

type ToolbarProps = {
  className?: string;
  defaultColor?: string;
  onDefaultColorChange?: (color: string) => void;
};

export function Toolbar({
  className,
  defaultColor = "#38bdf8",
  onDefaultColorChange,
}: ToolbarProps): React.JSX.Element {
  const { activeTool, setActiveTool } = useToolbar();
  const { isSignedIn } = useAuth();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const { shapes, updateShape, canEdit } = useShapes();
  const { selectedShapeIds } = useSelection();
  const snap = useSnapToGrid();
  const [internalDefaultColor, setInternalDefaultColor] =
    useState(defaultColor);

  // Use controlled or uncontrolled mode for default color
  const currentDefaultColor = onDefaultColorChange
    ? defaultColor
    : internalDefaultColor;

  // Get current color of selected shapes, default color, or "mixed"
  const getCurrentColor = (): string | "mixed" => {
    if (selectedShapeIds.length === 0) {
      // When no shapes selected, show the default color for new shapes
      return currentDefaultColor;
    }

    const selectedShapes = shapes.filter((s) =>
      selectedShapeIds.includes(s.id),
    );
    if (selectedShapes.length === 0) return currentDefaultColor;

    const firstColor = selectedShapes[0].fill;
    const allSameColor = selectedShapes.every((s) => s.fill === firstColor);

    return allSameColor ? firstColor : "mixed";
  };

  const handleColorChange = (color: string) => {
    if (!canEdit) return;

    if (selectedShapeIds.length === 0) {
      // No shapes selected: update default color for future shapes
      if (onDefaultColorChange) {
        onDefaultColorChange(color);
      } else {
        setInternalDefaultColor(color);
      }
    } else {
      // Apply color to all selected shapes
      for (const shapeId of selectedShapeIds) {
        updateShape(shapeId, { fill: color });
      }
    }
  };

  // Z-index operations
  const zIndexOps = getAvailableZIndexOperations(selectedShapeIds, shapes);

  const handleBringToFront = () => {
    if (!canEdit || selectedShapeIds.length === 0) return;
    const updates = bringToFront(selectedShapeIds, shapes);
    for (const [shapeId, zIndex] of updates.entries()) {
      updateShape(shapeId, { zIndex });
    }
  };

  const handleSendToBack = () => {
    if (!canEdit || selectedShapeIds.length === 0) return;
    const updates = sendToBack(selectedShapeIds, shapes);
    for (const [shapeId, zIndex] of updates.entries()) {
      updateShape(shapeId, { zIndex });
    }
  };

  const handleBringForward = () => {
    if (!canEdit || selectedShapeIds.length === 0) return;
    const updates = bringForward(selectedShapeIds, shapes);
    for (const [shapeId, zIndex] of updates.entries()) {
      updateShape(shapeId, { zIndex });
    }
  };

  const handleSendBackward = () => {
    if (!canEdit || selectedShapeIds.length === 0) return;
    const updates = sendBackward(selectedShapeIds, shapes);
    for (const [shapeId, zIndex] of updates.entries()) {
      updateShape(shapeId, { zIndex });
    }
  };

  // Alignment operations
  const selectedShapes = shapes.filter((s) => selectedShapeIds.includes(s.id));
  const alignOps = getAvailableAlignmentOperations(selectedShapes);

  const handleAlignLeft = () => {
    if (!canEdit || !alignOps.canAlign) return;
    const updates = alignLeft(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  const handleAlignCenter = () => {
    if (!canEdit || !alignOps.canAlign) return;
    const updates = alignCenter(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  const handleAlignRight = () => {
    if (!canEdit || !alignOps.canAlign) return;
    const updates = alignRight(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  const handleAlignTop = () => {
    if (!canEdit || !alignOps.canAlign) return;
    const updates = alignTop(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  const handleAlignMiddle = () => {
    if (!canEdit || !alignOps.canAlign) return;
    const updates = alignMiddle(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  const handleAlignBottom = () => {
    if (!canEdit || !alignOps.canAlign) return;
    const updates = alignBottom(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  const handleDistributeHorizontally = () => {
    if (!canEdit || !alignOps.canDistribute) return;
    const updates = distributeHorizontally(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  const handleDistributeVertically = () => {
    if (!canEdit || !alignOps.canDistribute) return;
    const updates = distributeVertically(selectedShapes);
    for (const [shapeId, shapeUpdates] of updates.entries()) {
      updateShape(shapeId, shapeUpdates);
    }
  };

  return (
    <nav className={clsx(styles.toolbar, className)} aria-label="Canvas tools">
      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonActive]: activeTool === "select",
        })}
        onClick={() => setActiveTool("select")}
      >
        <span aria-hidden>🖱️</span>
        Select
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonActive]: activeTool === "rectangle",
          [styles.toolButtonDisabled]: !isSignedIn,
        })}
        onClick={() => isSignedIn && setActiveTool("rectangle")}
        disabled={!isSignedIn}
        title={!isSignedIn ? "Sign in to create shapes" : "Rectangle tool"}
      >
        <span aria-hidden>▭</span>
        Rectangle
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonActive]: activeTool === "circle",
          [styles.toolButtonDisabled]: !isSignedIn,
        })}
        onClick={() => isSignedIn && setActiveTool("circle")}
        disabled={!isSignedIn}
        title={!isSignedIn ? "Sign in to create shapes" : "Circle tool"}
      >
        <span aria-hidden>⭕</span>
        Circle
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonActive]: activeTool === "text",
          [styles.toolButtonDisabled]: !isSignedIn,
        })}
        onClick={() => isSignedIn && setActiveTool("text")}
        disabled={!isSignedIn}
        title={!isSignedIn ? "Sign in to create shapes" : "Text tool"}
      >
        <span aria-hidden>T</span>
        Text
      </button>

      <div className={styles.toolDivider} />

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]: !canUndo || !isSignedIn,
        })}
        onClick={undo}
        disabled={!canUndo || !isSignedIn}
        title="Undo (Cmd+Z)"
      >
        <span aria-hidden>↶</span>
        Undo
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]: !canRedo || !isSignedIn,
        })}
        onClick={redo}
        disabled={!canRedo || !isSignedIn}
        title="Redo (Cmd+Shift+Z)"
      >
        <span aria-hidden>↷</span>
        Redo
      </button>

      <div className={styles.toolDivider} />
      <ColorPicker
        currentColor={getCurrentColor()}
        onColorChange={handleColorChange}
        disabled={!canEdit && !isSignedIn}
      />

      <div className={styles.toolDivider} />

      {/* Z-Index controls */}
      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit ||
            !isSignedIn ||
            selectedShapeIds.length === 0 ||
            !zIndexOps.canBringToFront,
        })}
        onClick={handleBringToFront}
        disabled={
          !canEdit ||
          !isSignedIn ||
          selectedShapeIds.length === 0 ||
          !zIndexOps.canBringToFront
        }
        title="Bring to Front (Cmd+])"
      >
        <span aria-hidden>⬆️</span>
        To Front
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit ||
            !isSignedIn ||
            selectedShapeIds.length === 0 ||
            !zIndexOps.canBringForward,
        })}
        onClick={handleBringForward}
        disabled={
          !canEdit ||
          !isSignedIn ||
          selectedShapeIds.length === 0 ||
          !zIndexOps.canBringForward
        }
        title="Bring Forward (Cmd+Shift+])"
      >
        <span aria-hidden>⤴️</span>
        Forward
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit ||
            !isSignedIn ||
            selectedShapeIds.length === 0 ||
            !zIndexOps.canSendBackward,
        })}
        onClick={handleSendBackward}
        disabled={
          !canEdit ||
          !isSignedIn ||
          selectedShapeIds.length === 0 ||
          !zIndexOps.canSendBackward
        }
        title="Send Backward (Cmd+Shift+[)"
      >
        <span aria-hidden>⤵️</span>
        Backward
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit ||
            !isSignedIn ||
            selectedShapeIds.length === 0 ||
            !zIndexOps.canSendToBack,
        })}
        onClick={handleSendToBack}
        disabled={
          !canEdit ||
          !isSignedIn ||
          selectedShapeIds.length === 0 ||
          !zIndexOps.canSendToBack
        }
        title="Send to Back (Cmd+[)"
      >
        <span aria-hidden>⬇️</span>
        To Back
      </button>

      <div className={styles.toolDivider} />

      {/* Alignment controls */}
      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canAlign,
        })}
        onClick={handleAlignLeft}
        disabled={!canEdit || !isSignedIn || !alignOps.canAlign}
        title="Align Left (Cmd+Shift+L)"
      >
        <span aria-hidden>⬅️</span>
        Left
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canAlign,
        })}
        onClick={handleAlignCenter}
        disabled={!canEdit || !isSignedIn || !alignOps.canAlign}
        title="Align Center (Cmd+Shift+H)"
      >
        <span aria-hidden>↔️</span>
        Center
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canAlign,
        })}
        onClick={handleAlignRight}
        disabled={!canEdit || !isSignedIn || !alignOps.canAlign}
        title="Align Right (Cmd+Shift+R)"
      >
        <span aria-hidden>➡️</span>
        Right
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canAlign,
        })}
        onClick={handleAlignTop}
        disabled={!canEdit || !isSignedIn || !alignOps.canAlign}
        title="Align Top (Cmd+Shift+T)"
      >
        <span aria-hidden>⬆️</span>
        Top
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canAlign,
        })}
        onClick={handleAlignMiddle}
        disabled={!canEdit || !isSignedIn || !alignOps.canAlign}
        title="Align Middle (Cmd+Shift+M)"
      >
        <span aria-hidden>↕️</span>
        Middle
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canAlign,
        })}
        onClick={handleAlignBottom}
        disabled={!canEdit || !isSignedIn || !alignOps.canAlign}
        title="Align Bottom (Cmd+Shift+B)"
      >
        <span aria-hidden>⬇️</span>
        Bottom
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canDistribute,
        })}
        onClick={handleDistributeHorizontally}
        disabled={!canEdit || !isSignedIn || !alignOps.canDistribute}
        title="Distribute Horizontally (Cmd+Shift+D)"
      >
        <span aria-hidden>⬌</span>
        H-Dist
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonDisabled]:
            !canEdit || !isSignedIn || !alignOps.canDistribute,
        })}
        onClick={handleDistributeVertically}
        disabled={!canEdit || !isSignedIn || !alignOps.canDistribute}
        title="Distribute Vertically (Cmd+Shift+V)"
      >
        <span aria-hidden>⬍</span>
        V-Dist
      </button>

      <div className={styles.toolDivider} />

      {/* Snap-to-grid toggle */}
      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonActive]: snap.snapEnabled,
        })}
        onClick={snap.toggleSnap}
        title={`Snap to Grid ${snap.snapEnabled ? "ON" : "OFF"} (${snap.gridSize}px)`}
      >
        <span aria-hidden>🧲</span>
        Snap
      </button>

      {/* Grid size selector */}
      <select
        className={styles.gridSizeSelect}
        value={snap.gridSize}
        onChange={(e) =>
          snap.updateGridSize(Number.parseInt(e.target.value, 10) as GridSize)
        }
        title="Grid size"
      >
        <option value="10">10px</option>
        <option value="20">20px</option>
        <option value="50">50px</option>
      </select>

      <div className={styles.toolDivider} />

      {/* Export button */}
      <button
        type="button"
        className={styles.toolButton}
        onClick={() => {
          // Call the export modal trigger from Canvas
          const openExportModal = (window as { openExportModal?: () => void })
            .openExportModal;
          if (openExportModal) {
            openExportModal();
          }
        }}
        title="Export canvas (Cmd+E)"
      >
        <span aria-hidden>💾</span>
        Export
      </button>

      <div className={styles.toolDivider} />
      <button
        type="button"
        className={styles.toolButton}
        onClick={() => {
          // Trigger keyboard shortcut to open help panel
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
        }}
        title="Keyboard shortcuts (press ?)"
      >
        <span aria-hidden>❓</span>
        Help
      </button>
    </nav>
  );
}
