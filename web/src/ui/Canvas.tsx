import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import type { PresenceState } from "../hooks/usePresence";
import { useToolbar } from "../hooks/useToolbar";
import { ShapeLayer } from "../shapes/ShapeLayer";
import { createRectangle } from "../shapes/types";
import { useShapes } from "../shapes/useShapes";
import styles from "./Canvas.module.css";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 600;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_SPEED = 1.1;

type CanvasProps = {
  presence: Map<number, PresenceState>;
  setPresence: (state: Partial<PresenceState>) => void;
};

export function Canvas({ presence, setPresence }: CanvasProps): JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(null);
  const { activeTool } = useToolbar();
  const { shapes, canEdit, createShape, updateShape } = useShapes();

  // State for rectangle creation (click-and-drag)
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRect, setNewRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // State for pan and zoom
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Ensure Stage is focused when tool changes and cleanup any pending drawing state
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      // Get the underlying DOM element and focus it
      const container = stage.container();
      if (container) {
        container.focus();
      }
    }
    
    // Clean up drawing state when switching tools
    setIsDrawing(false);
    setNewRect(null);
  }, [activeTool]);

  // Handle zoom with mouse wheel
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Calculate new scale
    const delta = e.evt.deltaY;
    const newScale = delta > 0 ? oldScale / ZOOM_SPEED : oldScale * ZOOM_SPEED;
    const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

    // Calculate new position to zoom towards pointer
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setScale(clampedScale);
    setPosition(newPos);
  };

  // Reset zoom and pan
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle cursor leaving canvas
  const handleMouseLeave = () => {
    setPresence({ cursor: null });
  };

  // Handle mouse down for both drawing and panning
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const clickedOnEmpty = e.target === stage;

    // Handle rectangle creation
    if (activeTool === "rectangle" && canEdit && clickedOnEmpty) {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Adjust for current zoom and pan
      const adjustedPos = {
        x: (pos.x - position.x) / scale,
        y: (pos.y - position.y) / scale,
      };

      setIsDrawing(true);
      setNewRect({
        x: adjustedPos.x,
        y: adjustedPos.y,
        width: 0,
        height: 0,
      });
      return;
    }

    // Handle panning (when clicking on empty space in select mode)
    if (clickedOnEmpty && activeTool === "select") {
      setIsPanning(true);
      stage.container().style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Adjust cursor position for zoom and pan before broadcasting
    const adjustedPos = {
      x: (pos.x - position.x) / scale,
      y: (pos.y - position.y) / scale,
    };
    setPresence({ cursor: adjustedPos });

    // Handle panning
    if (isPanning) {
      const dx = e.evt.movementX;
      const dy = e.evt.movementY;
      setPosition({
        x: position.x + dx,
        y: position.y + dy,
      });
      return;
    }

    // Update rectangle being drawn
    if (isDrawing && activeTool === "rectangle" && newRect) {
      setNewRect({
        x: newRect.x,
        y: newRect.y,
        width: adjustedPos.x - newRect.x,
        height: adjustedPos.y - newRect.y,
      });
    }
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();

    // Handle end of panning
    if (isPanning) {
      setIsPanning(false);
      if (stage) {
        stage.container().style.cursor = "default";
      }
      return;
    }

    // Handle end of rectangle drawing
    if (isDrawing && activeTool === "rectangle" && newRect && stage) {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const adjustedPos = {
        x: (pos.x - position.x) / scale,
        y: (pos.y - position.y) / scale,
      };

      // Calculate final dimensions
      const width = adjustedPos.x - newRect.x;
      const height = adjustedPos.y - newRect.y;

      // Only create if rectangle has minimum size
      if (Math.abs(width) > 10 && Math.abs(height) > 10) {
        // Normalize negative dimensions
        const x = width < 0 ? adjustedPos.x : newRect.x;
        const y = height < 0 ? adjustedPos.y : newRect.y;
        const normalizedWidth = Math.abs(width);
        const normalizedHeight = Math.abs(height);

        // Create the rectangle shape
        const rect = createRectangle(
          x,
          y,
          normalizedWidth,
          normalizedHeight,
          "user",
        );
        createShape(rect);
      }

      // Reset drawing state
      setIsDrawing(false);
      setNewRect(null);
    }
  };

  const remoteCursors = Array.from(presence.values()).filter(
    (participant) => participant.cursor,
  );

  return (
    <div className={styles.canvasWrapper}>
      {/* Zoom controls */}
      <div className={styles.zoomControls}>
        <button
          type="button"
          onClick={() => setScale(Math.min(MAX_ZOOM, scale * ZOOM_SPEED))}
          className={styles.zoomButton}
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetView}
          className={styles.zoomButton}
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setScale(Math.max(MIN_ZOOM, scale / ZOOM_SPEED))}
          className={styles.zoomButton}
          title="Zoom out"
        >
          −
        </button>
      </div>

      <Stage
        ref={stageRef}
        className={styles.stage}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <Layer>
          {/* Render persisted shapes from Yjs */}
          <ShapeLayer
            shapes={shapes}
            canEdit={canEdit}
            selectedTool={activeTool}
            onShapeUpdate={updateShape}
            onDragMove={(screenX, screenY) => {
              // Adjust screen coordinates to canvas space for presence
              const adjustedPos = {
                x: (screenX - position.x) / scale,
                y: (screenY - position.y) / scale,
              };
              setPresence({ cursor: adjustedPos });
            }}
          />

          {/* Render shape being drawn */}
          {newRect && isDrawing && (
            <Rect
              x={newRect.x}
              y={newRect.y}
              width={newRect.width}
              height={newRect.height}
              fill="rgba(56, 189, 248, 0.3)"
              stroke="#38bdf8"
              strokeWidth={2}
              dash={[5, 5]}
            />
          )}

          {/* Render remote cursors with labels */}
          {remoteCursors.map((participant) => {
            if (!participant.cursor) return null;
            const labelText = participant.displayName;
            const labelWidth = labelText.length * 8 + 12; // Approximate width
            
            return (
              <Group
                key={`${participant.userId}-cursor`}
                x={participant.cursor.x}
                y={participant.cursor.y}
              >
                {/* Cursor dot */}
                <Rect
                  x={0}
                  y={0}
                  width={12}
                  height={12}
                  fill={participant.color}
                  cornerRadius={4}
                />
                {/* Label background */}
                <Rect
                  x={16}
                  y={-2}
                  width={labelWidth}
                  height={20}
                  fill={participant.color}
                  cornerRadius={4}
                  shadowColor="rgba(0, 0, 0, 0.3)"
                  shadowBlur={4}
                  shadowOffsetY={2}
                />
                {/* Name label text */}
                <Text
                  x={22}
                  y={2}
                  text={labelText}
                  fontSize={12}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill="#fff"
                  shadowColor="rgba(0, 0, 0, 0.5)"
                  shadowBlur={2}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
