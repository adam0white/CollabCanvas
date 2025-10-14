/**
 * ShapeLayer - Renders all shapes from Yjs state
 *
 * Features:
 * - Renders rectangles from shapes array
 * - Handles drag-to-move for existing shapes (select tool)
 * - Auth-aware: only editable shapes can be dragged
 */

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Rect } from "react-konva";
import type { Shape } from "./types";
import { isRectangle } from "./types";

type ShapeLayerProps = {
  shapes: Shape[];
  canEdit: boolean;
  selectedTool: "select" | "rectangle";
  onShapeUpdate: (id: string, updates: Partial<Shape>) => void;
};

export function ShapeLayer({
  shapes,
  canEdit,
  selectedTool,
  onShapeUpdate,
}: ShapeLayerProps): JSX.Element {
  const handleDragEnd = (e: KonvaEventObject<DragEvent>, shape: Shape) => {
    if (!canEdit || selectedTool !== "select") return;

    const node = e.target as Konva.Shape;
    onShapeUpdate(shape.id, {
      x: node.x(),
      y: node.y(),
    });
  };

  return (
    <>
      {shapes.map((shape) => {
        if (isRectangle(shape)) {
          return (
            <Rect
              key={shape.id}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              fill={shape.fill}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth ?? 0}
              cornerRadius={8}
              shadowBlur={12}
              shadowOpacity={0.15}
              draggable={canEdit && selectedTool === "select"}
              onDragEnd={(e) => handleDragEnd(e, shape)}
            />
          );
        }
        return null;
      })}
    </>
  );
}
