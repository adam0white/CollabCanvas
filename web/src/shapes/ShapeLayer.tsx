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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Rect, Text, Transformer } from "react-konva";
import { getAdaptiveThrottleMs } from "../config/constants";
import type { LockingHook } from "../hooks/useLocking";
import type { Shape } from "./types";
import { isCircle, isRectangle, isText } from "./types";

type ShapeLayerProps = {
  shapes: Shape[];
  canEdit: boolean;
  selectedTool: "select" | "rectangle" | "circle" | "text";
  selectedShapeIds: string[];
  userId: string;
  locking: LockingHook;
  onShapeSelect: (id: string, addToSelection: boolean) => void;
  onShapeUpdate: (id: string, updates: Partial<Shape>) => void;
  onBatchShapeUpdate?: (
    updates: Array<{ id: string; updates: Partial<Shape> }>,
  ) => void;
  onDragMove?: (x: number, y: number) => void;
  onTextEdit?: (
    shapeId: string,
    currentText: string,
    position: { x: number; y: number },
  ) => void;
};

// Memoize ShapeLayer to prevent re-renders when parent re-renders
// Only re-render when shapes, selection, or tool changes
export const ShapeLayer = memo(function ShapeLayer({
  shapes,
  canEdit,
  selectedTool,
  selectedShapeIds,
  userId,
  locking,
  onShapeSelect,
  onShapeUpdate,
  onBatchShapeUpdate,
  onDragMove,
  onTextEdit,
}: ShapeLayerProps): React.JSX.Element {
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

  // Performance: Memoize shapes map for O(1) lookups instead of O(n) find()
  // Critical for large selections where we repeatedly look up shapes
  const shapesById = useMemo(
    () =>
      shapes.reduce(
        (acc, shape) => {
          acc[shape.id] = shape;
          return acc;
        },
        {} as Record<string, Shape>,
      ),
    [shapes],
  );

  // Attach transformer to selected shapes (multi-select support)
  // Performance optimization: For large selections (20+ shapes), disable transformer
  // and use a simple bounding box indicator instead
  useEffect(() => {
    if (transformerRef.current) {
      if (selectedShapeIds.length > 0 && selectedShapeIds.length < 20) {
        // Normal transformer for selections < 20 shapes
        const selectedNodes = selectedShapeIds
          .map((id) => shapeRefs.current[id])
          .filter((node): node is Konva.Shape => node !== null);

        if (selectedNodes.length > 0) {
          transformerRef.current.nodes(selectedNodes);
          transformerRef.current.getLayer()?.batchDraw();
        }
      } else {
        // Disable transformer for large selections (20+ shapes)
        // Transformer overhead with many shapes causes frame drops
        transformerRef.current.nodes([]);
      }
    }
  }, [selectedShapeIds]);

  // Memoize event handlers to prevent re-creating functions on every render
  const handleDragStart = useCallback(
    (_e: KonvaEventObject<DragEvent>, shape: Shape) => {
      // Store initial positions of all selected shapes for group dragging
      if (selectedShapeIds.includes(shape.id) && selectedShapeIds.length > 1) {
        dragStartPositionsRef.current = {};
        for (const shapeId of selectedShapeIds) {
          const targetShape = shapesById[shapeId];
          if (targetShape) {
            dragStartPositionsRef.current[shapeId] = {
              x: targetShape.x,
              y: targetShape.y,
            };
          }
        }
      }
    },
    [selectedShapeIds, shapesById],
  );

  const handleDragMove = useCallback(
    (e: KonvaEventObject<DragEvent>, shape: Shape) => {
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

      // Performance: Adaptive throttling based on selection size
      const throttleMs = getAdaptiveThrottleMs(selectedShapeIds.length);

      if (now - lastUpdate < throttleMs) return;

      lastDragUpdateRef.current[shape.id] = now;

      const node = e.target as Konva.Shape;
      const draggedShapeId = shape.id;

      // If multiple shapes are selected and this is one of them, move all selected shapes
      if (
        selectedShapeIds.includes(draggedShapeId) &&
        selectedShapeIds.length > 1
      ) {
        const startPos = dragStartPositionsRef.current[draggedShapeId];
        if (startPos) {
          // Calculate the offset from the original position
          const dx = node.x() - startPos.x;
          const dy = node.y() - startPos.y;

          // Performance: Use batch update for group drag (single Yjs transaction)
          if (onBatchShapeUpdate) {
            const updates: Array<{ id: string; updates: Partial<Shape> }> = [];

            for (const shapeId of selectedShapeIds) {
              const startPosition = dragStartPositionsRef.current[shapeId];
              if (startPosition) {
                updates.push({
                  id: shapeId,
                  updates: {
                    x: startPosition.x + dx,
                    y: startPosition.y + dy,
                  },
                });
              }
            }

            if (updates.length > 0) {
              onBatchShapeUpdate(updates);
            }
          } else {
            // Fallback: individual updates if batch not available
            for (const shapeId of selectedShapeIds) {
              const startPosition = dragStartPositionsRef.current[shapeId];
              if (startPosition) {
                onShapeUpdate(shapeId, {
                  x: startPosition.x + dx,
                  y: startPosition.y + dy,
                });
              }
            }
          }
        }
      } else {
        // Single shape drag
        onShapeUpdate(shape.id, {
          x: node.x(),
          y: node.y(),
        });
      }
    },
    [
      canEdit,
      selectedTool,
      selectedShapeIds,
      onShapeUpdate,
      onBatchShapeUpdate,
      onDragMove,
    ],
  );

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>, shape: Shape) => {
      if (!canEdit || selectedTool !== "select") return;

      const node = e.target as Konva.Shape;
      const draggedShapeId = shape.id;

      // If multiple shapes are selected and this is one of them, finalize positions for all
      if (
        selectedShapeIds.includes(draggedShapeId) &&
        selectedShapeIds.length > 1
      ) {
        const startPos = dragStartPositionsRef.current[draggedShapeId];
        if (startPos) {
          // Calculate the final offset
          const dx = node.x() - startPos.x;
          const dy = node.y() - startPos.y;

          // Performance: Use batch update for final position (single Yjs transaction)
          if (onBatchShapeUpdate) {
            const updates: Array<{ id: string; updates: Partial<Shape> }> = [];

            for (const shapeId of selectedShapeIds) {
              const startPosition = dragStartPositionsRef.current[shapeId];
              if (startPosition) {
                updates.push({
                  id: shapeId,
                  updates: {
                    x: startPosition.x + dx,
                    y: startPosition.y + dy,
                  },
                });
              }
            }

            if (updates.length > 0) {
              onBatchShapeUpdate(updates);
            }
          } else {
            // Fallback: individual updates if batch not available
            for (const shapeId of selectedShapeIds) {
              const startPosition = dragStartPositionsRef.current[shapeId];
              if (startPosition) {
                onShapeUpdate(shapeId, {
                  x: startPosition.x + dx,
                  y: startPosition.y + dy,
                });
              }
            }
          }
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
    },
    [
      canEdit,
      selectedTool,
      selectedShapeIds,
      onShapeUpdate,
      onBatchShapeUpdate,
    ],
  );

  const handleTransform = useCallback(
    (shape: Shape) => {
      if (!canEdit || selectedTool !== "select") return;

      // Set visual indicator
      if (transformingShapeId !== shape.id) {
        setTransformingShapeId(shape.id);
      }

      const now = performance.now();
      // Performance: Adaptive throttling based on selection size
      const throttleMs = getAdaptiveThrottleMs(selectedShapeIds.length);

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
      // Use shapesById for O(1) lookup instead of find()
      const currentShape = shapesById[shape.id];
      if (!currentShape) return;

      if (isCircle(currentShape)) {
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
      } else if (isRectangle(currentShape)) {
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
      } else if (isText(currentShape)) {
        const avgScale = (scaleX + scaleY) / 2;
        onShapeUpdate(shape.id, {
          x: node.x(),
          y: node.y(),
          fontSize: Math.max(8, currentShape.fontSize * avgScale),
          rotation: node.rotation(),
        });
        // Reset scale after broadcasting
        node.scaleX(1);
        node.scaleY(1);
      }
    },
    [
      canEdit,
      selectedTool,
      selectedShapeIds,
      onShapeUpdate,
      onDragMove,
      transformingShapeId,
      shapesById,
    ],
  );

  const handleTransformEnd = useCallback(
    (shape: Shape) => {
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
    },
    [canEdit, selectedTool, onShapeUpdate],
  );

  const handleShapeClick = useCallback(
    (shapeId: string, e: KonvaEventObject<Event>) => {
      if (selectedTool === "select" && canEdit) {
        // Check if Shift key is held for additive selection
        // For touch events, shiftKey won't be available, default to false
        const evt = e.evt as MouseEvent | TouchEvent;
        const addToSelection = "shiftKey" in evt ? evt.shiftKey : false;
        onShapeSelect(shapeId, addToSelection);
      }
    },
    [selectedTool, canEdit, onShapeSelect],
  );

  const handleTextDoubleClick = useCallback(
    (shape: Shape) => {
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
    },
    [canEdit, onTextEdit],
  );

  // Calculate bounding box for large selections (20+ shapes)
  // Used to show visual feedback without expensive Transformer
  const selectionBounds = useMemo(() => {
    if (selectedShapeIds.length < 20) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    // Performance: Use shapesById for O(1) lookups instead of find()
    for (const shapeId of selectedShapeIds) {
      const shape = shapesById[shapeId];
      if (!shape) continue;

      // Calculate shape bounds based on type
      let x1 = shape.x;
      let y1 = shape.y;
      let x2 = shape.x;
      let y2 = shape.y;

      if (isRectangle(shape)) {
        x2 = shape.x + shape.width;
        y2 = shape.y + shape.height;
      } else if (isCircle(shape)) {
        x1 = shape.x - shape.radius;
        y1 = shape.y - shape.radius;
        x2 = shape.x + shape.radius;
        y2 = shape.y + shape.radius;
      } else if (isText(shape)) {
        const width = shape.width ?? shape.text.length * shape.fontSize * 0.6;
        const height = shape.fontSize * 1.2;
        x2 = shape.x + width;
        y2 = shape.y + height;
      }

      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2);
      maxY = Math.max(maxY, y2);
    }

    if (minX === Number.POSITIVE_INFINITY) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [selectedShapeIds, shapesById]);

  return (
    <>
      {shapes.map((shape) => {
        const isHovered = hoveredShapeId === shape.id;
        const isSelected = selectedShapeIds.includes(shape.id);
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
              shadowBlur={isSelected || (isHovered && isDraggable) ? 16 : 12}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.25 : 0.15
              }
              opacity={isTransforming ? 0.8 : 1}
              draggable={isDraggable}
              // Konva performance optimizations
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
              hitStrokeWidth={0}
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
              shadowBlur={isSelected || (isHovered && isDraggable) ? 16 : 12}
              shadowOpacity={
                isSelected || (isHovered && isDraggable) ? 0.25 : 0.15
              }
              opacity={isTransforming ? 0.8 : 1}
              draggable={isDraggable}
              // Konva performance optimizations
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
              hitStrokeWidth={0}
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
              opacity={isTransforming ? 0.8 : 1}
              draggable={isDraggable}
              // Konva performance optimizations
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
              hitStrokeWidth={0}
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
      {/* Performance: Only show transformer for selections < 20 shapes */}
      {/* Large selections use drag-only mode for better performance */}
      {canEdit && selectedTool === "select" && selectedShapeIds.length < 20 && (
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
          // Disable rotation for selections with 10+ shapes to improve performance
          rotateEnabled={selectedShapeIds.length < 10}
          onTransform={() => {
            // Performance optimization: only transform first shape during interaction
            // All shapes will be transformed on transformEnd
            if (selectedShapeIds.length > 0) {
              const firstShapeId = selectedShapeIds[0];
              const firstShape = shapesById[firstShapeId];
              if (firstShape) {
                handleTransform(firstShape);
              }
            }
          }}
        />
      )}

      {/* Simple bounding box for large selections (20+ shapes) */}
      {/* Shows visual feedback without Transformer overhead */}
      {canEdit &&
        selectedTool === "select" &&
        selectedShapeIds.length >= 20 &&
        selectionBounds && (
          <Rect
            x={selectionBounds.x}
            y={selectionBounds.y}
            width={selectionBounds.width}
            height={selectionBounds.height}
            stroke="#0ea5e9"
            strokeWidth={2}
            dash={[8, 4]}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}
    </>
  );
});
