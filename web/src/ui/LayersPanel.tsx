/**
 * Layers Panel - Visual layer management sidebar
 *
 * Features:
 * - List all shapes with type icons
 * - Click to select shapes
 * - Visibility toggle (eye icon)
 * - Lock toggle (lock icon)
 * - Drag to reorder (updates z-index)
 */

import { useState } from "react";
import type { Shape } from "../shapes/types";
import { isCircle, isRectangle, isText } from "../shapes/types";
import { getZIndex, sortShapesByZIndex } from "../shapes/zindex";
import styles from "./LayersPanel.module.css";

type LayersPanelProps = {
  shapes: Shape[];
  selectedShapeIds: string[];
  canEdit: boolean;
  onShapeSelect: (id: string) => void;
  onVisibilityToggle: (id: string, visible: boolean) => void;
  onLockToggle: (id: string, locked: boolean) => void;
  onReorder: (shapeId: string, newZIndex: number) => void;
};

export function LayersPanel({
  shapes,
  selectedShapeIds,
  canEdit,
  onShapeSelect,
  onVisibilityToggle,
  onLockToggle,
  onReorder,
}: LayersPanelProps): React.JSX.Element {
  const [draggedShapeId, setDraggedShapeId] = useState<string | null>(null);
  const [dragOverShapeId, setDragOverShapeId] = useState<string | null>(null);

  // Sort shapes by zIndex (top to bottom in list = high to low zIndex)
  const sortedShapes = sortShapesByZIndex(shapes).reverse();

  const getShapeIcon = (shape: Shape): string => {
    if (isRectangle(shape)) return "▭";
    if (isCircle(shape)) return "⭕";
    if (isText(shape)) return "T";
    return "?";
  };

  const getShapeLabel = (shape: Shape): string => {
    if (isRectangle(shape)) return `Rectangle`;
    if (isCircle(shape)) return `Circle`;
    if (isText(shape))
      return `Text: ${shape.text.substring(0, 20)}${shape.text.length > 20 ? "..." : ""}`;
    return "Shape";
  };

  const handleDragStart = (e: React.DragEvent, shapeId: string) => {
    setDraggedShapeId(shapeId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, shapeId: string) => {
    e.preventDefault();
    setDragOverShapeId(shapeId);
  };

  const handleDrop = (e: React.DragEvent, targetShapeId: string) => {
    e.preventDefault();

    if (!draggedShapeId || draggedShapeId === targetShapeId) {
      setDraggedShapeId(null);
      setDragOverShapeId(null);
      return;
    }

    // Get zIndex values
    const draggedShape = shapes.find((s) => s.id === draggedShapeId);
    const targetShape = shapes.find((s) => s.id === targetShapeId);

    if (!draggedShape || !targetShape) {
      setDraggedShapeId(null);
      setDragOverShapeId(null);
      return;
    }

    // Reorder: set dragged shape's zIndex to target's zIndex
    const newZIndex = getZIndex(targetShape);
    onReorder(draggedShapeId, newZIndex);

    setDraggedShapeId(null);
    setDragOverShapeId(null);
  };

  const handleDragEnd = () => {
    setDraggedShapeId(null);
    setDragOverShapeId(null);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Layers</h3>
        <span className={styles.count}>{shapes.length}</span>
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: Layers list needs custom styling and drag-drop behavior */}
      <div className={styles.list} role="list">
        {sortedShapes.length === 0 ? (
          <div className={styles.empty}>No shapes on canvas</div>
        ) : (
          sortedShapes.map((shape) => {
            const isSelected = selectedShapeIds.includes(shape.id);
            const isVisible = shape.visible !== false;
            const isLocked = shape.locked === true;
            const isDragging = draggedShapeId === shape.id;
            const isDragOver = dragOverShapeId === shape.id;

            return (
              <div
                key={shape.id}
                className={`${styles.layer} ${isSelected ? styles.layerSelected : ""} ${isDragging ? styles.layerDragging : ""} ${isDragOver ? styles.layerDragOver : ""}`}
              >
                <button
                  type="button"
                  className={styles.layerMain}
                  onClick={() => onShapeSelect(shape.id)}
                  draggable={canEdit}
                  onDragStart={(e) =>
                    handleDragStart(e as unknown as React.DragEvent, shape.id)
                  }
                  onDragOver={(e) =>
                    handleDragOver(e as unknown as React.DragEvent, shape.id)
                  }
                  onDrop={(e) =>
                    handleDrop(e as unknown as React.DragEvent, shape.id)
                  }
                  onDragEnd={handleDragEnd}
                >
                  <span className={styles.icon}>{getShapeIcon(shape)}</span>
                  <span className={styles.label}>{getShapeLabel(shape)}</span>
                </button>

                <div className={styles.controls}>
                  {/* Visibility toggle */}
                  <button
                    type="button"
                    className={styles.controlButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) {
                        onVisibilityToggle(shape.id, !isVisible);
                      }
                    }}
                    title={isVisible ? "Hide" : "Show"}
                    disabled={!canEdit}
                  >
                    {isVisible ? "👁️" : "👁️‍🗨️"}
                  </button>

                  {/* Lock toggle */}
                  <button
                    type="button"
                    className={styles.controlButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) {
                        onLockToggle(shape.id, !isLocked);
                      }
                    }}
                    title={isLocked ? "Unlock" : "Lock"}
                    disabled={!canEdit}
                  >
                    {isLocked ? "🔒" : "🔓"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
