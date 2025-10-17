/**
 * ShapeLayer - Renders all shapes from Yjs state
 *
 * Features:
 * - Renders rectangles from shapes array
 * - Handles drag-to-move for existing shapes (select tool)
 * - Auth-aware: only editable shapes can be dragged
 * - Broadcasts shape positions during drag (throttled)
 */

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef, useState } from "react";
import { Circle, Rect, Text, Transformer } from "react-konva";
import type { Shape } from "./types";
import { isCircle, isRectangle, isText } from "./types";

type ShapeLayerProps = {
  shapes: Shape[];
  canEdit: boolean;
  selectedTool: "select" | "rectangle" | "circle" | "text";
  selectedShapeId: string | null;
  onShapeSelect: (id: string | null) => void;
  onShapeUpdate: (id: string, updates: Partial<Shape>) => void;
  onDragMove?: (x: number, y: number) => void;
  onTextEdit?: (
    shapeId: string,
    currentText: string,
    position: { x: number; y: number },
  ) => void;
};

const DRAG_UPDATE_INTERVAL_MS = 50; // Throttle shape updates during drag

export function ShapeLayer({
  shapes,
  canEdit,
  selectedTool,
  selectedShapeId,
  onShapeSelect,
  onShapeUpdate,
  onDragMove,
  onTextEdit,
}: ShapeLayerProps): React.JSX.Element {
  const lastDragUpdateRef = useRef<{ [key: string]: number }>({});
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const shapeRefs = useRef<{ [key: string]: Konva.Shape | null }>({});
  const lastTransformUpdateRef = useRef(0);

  // Attach transformer to selected shape
  useEffect(() => {
    if (transformerRef.current && selectedShapeId) {
      const selectedNode = shapeRefs.current[selectedShapeId];
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedShapeId]);

  const handleDragMove = (e: KonvaEventObject<DragEvent>, shape: Shape) => {
    // Update cursor position for presence
    if (onDragMove) {
      const stage = e.target.getStage();
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) {
          onDragMove(pos.x, pos.y);
        }
      }
    }

    // Throttled shape position broadcast during drag
    if (!canEdit || selectedTool !== "select") return;

    const now = performance.now();
    const lastUpdate = lastDragUpdateRef.current[shape.id] ?? 0;

    if (now - lastUpdate < DRAG_UPDATE_INTERVAL_MS) return;

    lastDragUpdateRef.current[shape.id] = now;

    const node = e.target as Konva.Shape;
    onShapeUpdate(shape.id, {
      x: node.x(),
      y: node.y(),
    });
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, shape: Shape) => {
    if (!canEdit || selectedTool !== "select") return;

    // Final position update on drag end
    const node = e.target as Konva.Shape;
    onShapeUpdate(shape.id, {
      x: node.x(),
      y: node.y(),
    });

    // Clear throttle tracking for this shape
    delete lastDragUpdateRef.current[shape.id];
  };

  const handleTransform = () => {
    // Update cursor position during transform (throttled)
    if (!onDragMove) return;

    const now = performance.now();
    if (now - lastTransformUpdateRef.current < DRAG_UPDATE_INTERVAL_MS) {
      return;
    }
    lastTransformUpdateRef.current = now;

    const transformer = transformerRef.current;
    if (!transformer) return;

    const stage = transformer.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (pos) {
      onDragMove(pos.x, pos.y);
    }
  };

  const handleTransformEnd = (shape: Shape) => {
    if (!canEdit || selectedTool !== "select") return;

    const node = shapeRefs.current[shape.id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to dimensions
    node.scaleX(1);
    node.scaleY(1);

    // Handle different shape types
    if (isCircle(shape)) {
      // For circles, maintain aspect ratio using the average scale
      const avgScale = (scaleX + scaleY) / 2;
      const currentRadius = (node as Konva.Circle).radius();
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
        radius: Math.max(5, currentRadius * avgScale),
        rotation: node.rotation(),
      });
    } else if (isRectangle(shape)) {
      // For rectangles, apply scale to width and height
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      });
    } else if (isText(shape)) {
      // For text, update fontSize based on scale
      const avgScale = (scaleX + scaleY) / 2;
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
        fontSize: Math.max(8, shape.fontSize * avgScale),
        rotation: node.rotation(),
      });
    }
  };

  const handleShapeClick = (shapeId: string) => {
    if (selectedTool === "select" && canEdit) {
      onShapeSelect(shapeId);
    }
  };

  const handleTextDoubleClick = (shape: Shape) => {
    if (!canEdit || !isText(shape) || !onTextEdit) return;

    // Get the node to find its screen position
    const node = shapeRefs.current[shape.id];
    if (!node) return;

    const stage = node.getStage();
    if (!stage) return;

    // Convert shape position to screen coordinates
    const transform = node.getAbsoluteTransform();
    const pos = transform.point({ x: 0, y: 0 });

    onTextEdit(shape.id, shape.text, pos);
  };

  return (
    <>
      {shapes.map((shape) => {
        const isHovered = hoveredShapeId === shape.id;
        const isSelected = selectedShapeId === shape.id;
        const isDraggable = canEdit && selectedTool === "select";

        if (isRectangle(shape)) {
          return (
            <Rect
              key={shape.id}
              ref={(node) => {
                shapeRefs.current[shape.id] = node;
              }}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              rotation={shape.rotation ?? 0}
              fill={shape.fill}
              stroke={
                isSelected
                  ? "#0ea5e9"
                  : isHovered && isDraggable
                    ? "#0ea5e9"
                    : shape.stroke
              }
              strokeWidth={
                isSelected
                  ? 3
                  : isHovered && isDraggable
                    ? 3
                    : (shape.strokeWidth ?? 0)
              }
              cornerRadius={8}
              shadowBlur={isSelected || (isHovered && isDraggable) ? 16 : 12}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.25 : 0.15
              }
              draggable={isDraggable}
              onClick={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id);
                }
              }}
              onTap={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id);
                }
              }}
              onMouseEnter={() => isDraggable && setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId(null)}
              onDragMove={(e) => handleDragMove(e, shape)}
              onDragEnd={(e) => handleDragEnd(e, shape)}
              onTransformEnd={() => handleTransformEnd(shape)}
            />
          );
        }

        if (isCircle(shape)) {
          return (
            <Circle
              key={shape.id}
              ref={(node) => {
                shapeRefs.current[shape.id] = node;
              }}
              x={shape.x}
              y={shape.y}
              radius={shape.radius}
              rotation={shape.rotation ?? 0}
              fill={shape.fill}
              stroke={
                isSelected
                  ? "#0ea5e9"
                  : isHovered && isDraggable
                    ? "#0ea5e9"
                    : shape.stroke
              }
              strokeWidth={
                isSelected
                  ? 3
                  : isHovered && isDraggable
                    ? 3
                    : (shape.strokeWidth ?? 0)
              }
              shadowBlur={isSelected || (isHovered && isDraggable) ? 16 : 12}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.25 : 0.15
              }
              draggable={isDraggable}
              onClick={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id);
                }
              }}
              onTap={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id);
                }
              }}
              onMouseEnter={() => isDraggable && setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId(null)}
              onDragMove={(e) => handleDragMove(e, shape)}
              onDragEnd={(e) => handleDragEnd(e, shape)}
              onTransformEnd={() => handleTransformEnd(shape)}
            />
          );
        }

        if (isText(shape)) {
          return (
            <Text
              key={shape.id}
              ref={(node) => {
                shapeRefs.current[shape.id] = node;
              }}
              x={shape.x}
              y={shape.y}
              text={shape.text}
              fontSize={shape.fontSize}
              fontFamily={shape.fontFamily ?? "Arial"}
              align={shape.align ?? "left"}
              width={shape.width}
              rotation={shape.rotation ?? 0}
              fill={shape.fill}
              stroke={
                isSelected
                  ? "#0ea5e9"
                  : isHovered && isDraggable
                    ? "#0ea5e9"
                    : shape.stroke
              }
              strokeWidth={
                isSelected
                  ? 2
                  : isHovered && isDraggable
                    ? 2
                    : (shape.strokeWidth ?? 0)
              }
              shadowBlur={isSelected || (isHovered && isDraggable) ? 16 : 12}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.25 : 0.15
              }
              draggable={isDraggable}
              onClick={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id);
                }
              }}
              onTap={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id);
                }
              }}
              onMouseEnter={() => isDraggable && setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId(null)}
              onDragMove={(e) => handleDragMove(e, shape)}
              onDragEnd={(e) => handleDragEnd(e, shape)}
              onTransformEnd={() => handleTransformEnd(shape)}
              onDblClick={() => handleTextDoubleClick(shape)}
              onDblTap={() => handleTextDoubleClick(shape)}
            />
          );
        }

        return null;
      })}

      {/* Transformer for selected shape */}
      {canEdit && selectedTool === "select" && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit minimum size
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          onTransform={handleTransform}
        />
      )}
    </>
  );
}
