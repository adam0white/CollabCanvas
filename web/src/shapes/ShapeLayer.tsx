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
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Rect, Text, Transformer } from "react-konva";
import { THROTTLE } from "../config/constants";
import type { LockingHook } from "../hooks/useLocking";
import type { Shape } from "./types";
import { isCircle, isRectangle, isText } from "./types";
import { useShapes } from "./useShapes";

type ShapeLayerProps = {
  shapes: Shape[];
  canEdit: boolean;
  selectedTool: "select" | "rectangle" | "circle" | "text";
  selectedShapeIds: string[];
  userId: string;
  locking: LockingHook;
  onShapeSelect: (id: string, addToSelection: boolean) => void;
  onShapeUpdate: (id: string, updates: Partial<Shape>) => void;
  onDragMove?: (x: number, y: number) => void;
  onTextEdit?: (
    shapeId: string,
    currentText: string,
    position: { x: number; y: number },
  ) => void;
};

function ShapeLayerImpl({
  shapes,
  canEdit,
  selectedTool,
  selectedShapeIds,
  userId,
  locking,
  onShapeSelect,
  onShapeUpdate,
  onDragMove,
  onTextEdit,
}: ShapeLayerProps): React.JSX.Element {
  const { updateShapesBatch } = useShapes();
  const lastDragUpdateRef = useRef<{ [key: string]: number }>({});
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [transformingShapeId, setTransformingShapeId] = useState<string | null>(
    null,
  );
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const shapeRefs = useRef<{ [key: string]: Konva.Shape | null }>({});
  const lastTransformUpdateRef = useRef(0);

  // Track initial positions for group dragging
  const dragStartPositionsRef = useRef<{
    [key: string]: { x: number; y: number };
  }>({});

  // Fast selection membership lookup
  const selectedSet = useMemo(
    () => new Set(selectedShapeIds),
    [selectedShapeIds],
  );

  // Attach transformer to selected shapes (multi-select support)
  useEffect(() => {
    // For very large selections, avoid attaching transformer for performance
    const transformer = transformerRef.current;
    if (
      transformer &&
      selectedShapeIds.length > 0 &&
      selectedShapeIds.length < 30
    ) {
      const selectedNodes = selectedShapeIds
        .map((id) => shapeRefs.current[id])
        .filter((node): node is Konva.Shape => node !== null);

      if (selectedNodes.length > 0) {
        transformer.nodes(selectedNodes);
        transformer.getLayer()?.batchDraw();
      }
    } else if (transformer) {
      transformer.nodes([]);
    }
  }, [selectedShapeIds]);

  const handleDragStart = (_e: KonvaEventObject<DragEvent>, shape: Shape) => {
    // Store initial positions of all selected shapes for group dragging
    if (selectedSet.has(shape.id) && selectedShapeIds.length > 1) {
      dragStartPositionsRef.current = {};
      for (const shapeId of selectedShapeIds) {
        const targetShape = shapes.find((s) => s.id === shapeId);
        if (targetShape) {
          dragStartPositionsRef.current[shapeId] = {
            x: targetShape.x,
            y: targetShape.y,
          };
        }
      }
    }
  };

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

    if (now - lastUpdate < THROTTLE.TRANSFORM_MS) return;

    lastDragUpdateRef.current[shape.id] = now;

    const node = e.target as Konva.Shape;
    const draggedShapeId = shape.id;

    // If multiple shapes are selected and this is one of them, move all selected shapes
    if (selectedSet.has(draggedShapeId) && selectedShapeIds.length > 1) {
      const startPos = dragStartPositionsRef.current[draggedShapeId];
      if (startPos) {
        // Calculate the offset from the original position
        const dx = node.x() - startPos.x;
        const dy = node.y() - startPos.y;

        // Apply the same offset to all selected shapes in a single transaction
        const batch: Array<{ id: string; updates: Partial<Shape> }> = [];
        for (const shapeId of selectedShapeIds) {
          const startPosition = dragStartPositionsRef.current[shapeId];
          if (!startPosition) continue;
          batch.push({
            id: shapeId,
            updates: { x: startPosition.x + dx, y: startPosition.y + dy },
          });
        }
        updateShapesBatch(batch);
      }
    } else {
      // Single shape drag
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
      });
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, shape: Shape) => {
    if (!canEdit || selectedTool !== "select") return;

    const node = e.target as Konva.Shape;
    const draggedShapeId = shape.id;

    // If multiple shapes are selected and this is one of them, finalize positions for all
    if (selectedSet.has(draggedShapeId) && selectedShapeIds.length > 1) {
      const startPos = dragStartPositionsRef.current[draggedShapeId];
      if (startPos) {
        // Calculate the final offset
        const dx = node.x() - startPos.x;
        const dy = node.y() - startPos.y;

        const batch: Array<{ id: string; updates: Partial<Shape> }> = [];
        for (const shapeId of selectedShapeIds) {
          const startPosition = dragStartPositionsRef.current[shapeId];
          if (!startPosition) continue;
          batch.push({
            id: shapeId,
            updates: { x: startPosition.x + dx, y: startPosition.y + dy },
          });
        }
        updateShapesBatch(batch);
      }

      // Clear drag start positions
      dragStartPositionsRef.current = {};
    } else {
      // Single shape drag end
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
      });
    }

    // Clear throttle tracking for this shape
    delete lastDragUpdateRef.current[shape.id];
  };

  const handleTransform = (shape: Shape) => {
    if (!canEdit || selectedTool !== "select") return;

    // Set visual indicator
    if (transformingShapeId !== shape.id) {
      setTransformingShapeId(shape.id);
    }

    const now = performance.now();
    // Use aggressive throttling for large selections (30+ shapes)
    const throttleMs =
      selectedShapeIds.length >= 30
        ? THROTTLE.TRANSFORM_MS_LARGE_SELECTION
        : THROTTLE.TRANSFORM_MS;

    if (now - lastTransformUpdateRef.current < throttleMs) {
      return;
    }
    lastTransformUpdateRef.current = now;

    // Skip cursor updates for large selections to improve performance
    if (selectedShapeIds.length < 20 && onDragMove) {
      const transformer = transformerRef.current;
      if (transformer) {
        const stage = transformer.getStage();
        if (stage) {
          const pos = stage.getPointerPosition();
          if (pos) {
            onDragMove(pos.x, pos.y);
          }
        }
      }
    }

    // Broadcast throttled transform updates
    const node = shapeRefs.current[shape.id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Prepare updates based on shape type
    if (isCircle(shape)) {
      const avgScale = (scaleX + scaleY) / 2;
      const currentRadius = (node as Konva.Circle).radius();
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
        radius: Math.max(5, currentRadius * avgScale),
        rotation: node.rotation(),
      });
      // Reset scale after broadcasting
      node.scaleX(1);
      node.scaleY(1);
    } else if (isRectangle(shape)) {
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      });
      // Reset scale after broadcasting
      node.scaleX(1);
      node.scaleY(1);
    } else if (isText(shape)) {
      const avgScale = (scaleX + scaleY) / 2;
      onShapeUpdate(shape.id, {
        x: node.x(),
        y: node.y(),
        fontSize: Math.max(8, shape.fontSize * avgScale),
        rotation: node.rotation(),
      });
      // Reset scale after broadcasting
      node.scaleX(1);
      node.scaleY(1);
    }
  };

  const handleTransformEnd = (shape: Shape) => {
    if (!canEdit || selectedTool !== "select") return;

    // Clear visual indicator
    setTransformingShapeId(null);

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

  const handleShapeClick = (shapeId: string, e: KonvaEventObject<Event>) => {
    if (selectedTool === "select" && canEdit) {
      // Check if Shift key is held for additive selection
      // For touch events, shiftKey won't be available, default to false
      const evt = e.evt as MouseEvent | TouchEvent;
      const addToSelection = "shiftKey" in evt ? evt.shiftKey : false;
      onShapeSelect(shapeId, addToSelection);
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
        const isSelected = selectedSet.has(shape.id);
        const isTransforming = transformingShapeId === shape.id;
        const lockOwner = locking.getLockOwner(shape.id);
        const isLockedByOther =
          lockOwner !== null && lockOwner.userId !== userId;
        const isDraggable =
          canEdit && selectedTool === "select" && !isLockedByOther;

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
              perfectDrawEnabled={false}
              stroke={
                isLockedByOther
                  ? lockOwner.color
                  : isSelected
                    ? "#0ea5e9"
                    : isHovered && isDraggable
                      ? "#0ea5e9"
                      : shape.stroke
              }
              strokeWidth={
                isLockedByOther
                  ? 3
                  : isSelected
                    ? 3
                    : isHovered && isDraggable
                      ? 3
                      : (shape.strokeWidth ?? 0)
              }
              cornerRadius={8}
              shadowBlur={isSelected || (isHovered && isDraggable) ? 8 : 6}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.2 : 0.12
              }
              opacity={isTransforming ? 0.8 : 1}
              draggable={isDraggable}
              onClick={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id, e);
                }
              }}
              onTap={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id, e);
                }
              }}
              onMouseEnter={() => isDraggable && setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId(null)}
              onDragStart={(e) => handleDragStart(e, shape)}
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
              perfectDrawEnabled={false}
              stroke={
                isLockedByOther
                  ? lockOwner.color
                  : isSelected
                    ? "#0ea5e9"
                    : isHovered && isDraggable
                      ? "#0ea5e9"
                      : shape.stroke
              }
              strokeWidth={
                isLockedByOther
                  ? 3
                  : isSelected
                    ? 3
                    : isHovered && isDraggable
                      ? 3
                      : (shape.strokeWidth ?? 0)
              }
              shadowBlur={isSelected || (isHovered && isDraggable) ? 8 : 6}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.2 : 0.12
              }
              opacity={isTransforming ? 0.8 : 1}
              draggable={isDraggable}
              onClick={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id, e);
                }
              }}
              onTap={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id, e);
                }
              }}
              onMouseEnter={() => isDraggable && setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId(null)}
              onDragStart={(e) => handleDragStart(e, shape)}
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
              perfectDrawEnabled={false}
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
              shadowBlur={isSelected || (isHovered && isDraggable) ? 8 : 6}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.2 : 0.12
              }
              opacity={isTransforming ? 0.8 : 1}
              draggable={isDraggable}
              onClick={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id, e);
                }
              }}
              onTap={(e) => {
                if (selectedTool === "select" && canEdit) {
                  e.cancelBubble = true;
                  handleShapeClick(shape.id, e);
                }
              }}
              onMouseEnter={() => isDraggable && setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId(null)}
              onDragStart={(e) => handleDragStart(e, shape)}
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
      {canEdit &&
        selectedTool === "select" &&
        selectedShapeIds.length > 0 &&
        selectedShapeIds.length < 30 && (
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
            // Disable rotation for large selections to improve performance
            rotateEnabled={selectedShapeIds.length < 20}
            onTransform={() => {
              // Performance optimization: only transform first shape during interaction
              // All shapes will be transformed on transformEnd
              if (selectedShapeIds.length > 0) {
                const firstShapeId = selectedShapeIds[0];
                const firstShape = shapes.find((s) => s.id === firstShapeId);
                if (firstShape) {
                  handleTransform(firstShape);
                }
              }
            }}
          />
        )}
    </>
  );
}

// Memoize to avoid re-rendering unchanged shapes during presence/selection updates
export const ShapeLayer = memo(ShapeLayerImpl, (prev, next) => {
  // Stable equality checks
  if (prev.canEdit !== next.canEdit) return false;
  if (prev.selectedTool !== next.selectedTool) return false;
  if (prev.userId !== next.userId) return false;
  // Compare selection by size and first/last IDs to avoid O(n) cost; fallback if lengths differ
  if (prev.selectedShapeIds.length !== next.selectedShapeIds.length)
    return false;
  for (let i = 0; i < prev.selectedShapeIds.length; i++) {
    if (prev.selectedShapeIds[i] !== next.selectedShapeIds[i]) return false;
  }
  // Shallow compare shapes array by length and id/version-critical props
  if (prev.shapes.length !== next.shapes.length) return false;
  for (let i = 0; i < prev.shapes.length; i++) {
    const a = prev.shapes[i] as Shape;
    const b = next.shapes[i] as Shape;
    if (a.id !== b.id) return false;
    if (a.x !== b.x || a.y !== b.y) return false;
    if (a.rotation !== b.rotation) return false;
    // Size props per type
    if ("width" in a !== "width" in b) return false;
    if ("height" in a !== "height" in b) return false;
    if ("radius" in a !== "radius" in b) return false;
    if (
      "width" in a &&
      (a as Record<string, unknown>).width !==
        (b as Record<string, unknown>).width
    )
      return false;
    if (
      "height" in a &&
      (a as Record<string, unknown>).height !==
        (b as Record<string, unknown>).height
    )
      return false;
    if (
      "radius" in a &&
      (a as Record<string, unknown>).radius !==
        (b as Record<string, unknown>).radius
    )
      return false;
    // Visuals that materially affect drawing
    if (a.fill !== b.fill) return false;
    if (a.stroke !== b.stroke) return false;
    if (a.strokeWidth !== b.strokeWidth) return false;
    if ("text" in a !== "text" in b) return false;
    if (
      "text" in a &&
      (a as Record<string, unknown>).text !==
        (b as Record<string, unknown>).text
    )
      return false;
  }
  return true;
});
