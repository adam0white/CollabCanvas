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

  // Handle cursor leaving canvas
  const handleMouseLeave = () => {
    setPresence({ cursor: null });
  };

  // Handle rectangle creation (click-and-drag)
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (activeTool !== "rectangle" || !canEdit) return;

    // Only start drawing if clicking on the stage (not on a shape)
    if (e.target !== e.target.getStage()) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setNewRect({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
    });
  };

  const handleMouseMove = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Always update cursor presence
    setPresence({ cursor: pos });

    // Update rectangle being drawn
    if (isDrawing && activeTool === "rectangle" && newRect) {
      setNewRect({
        x: newRect.x,
        y: newRect.y,
        width: pos.x - newRect.x,
        height: pos.y - newRect.y,
      });
    }
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || activeTool !== "rectangle" || !newRect) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Calculate final dimensions
    const width = pos.x - newRect.x;
    const height = pos.y - newRect.y;

    // Only create if rectangle has minimum size
    if (Math.abs(width) > 10 && Math.abs(height) > 10) {
      // Normalize negative dimensions
      const x = width < 0 ? pos.x : newRect.x;
      const y = height < 0 ? pos.y : newRect.y;
      const normalizedWidth = Math.abs(width);
      const normalizedHeight = Math.abs(height);

      // Create the rectangle shape
      const rect = createRectangle(
        x,
        y,
        normalizedWidth,
        normalizedHeight,
        "user", // Will be replaced by actual userId in useShapes
      );
      createShape(rect);
    }

    // Reset drawing state
    setIsDrawing(false);
    setNewRect(null);
  };

  const remoteCursors = Array.from(presence.values()).filter(
    (participant) => participant.cursor,
  );

  return (
    <div className={styles.canvasWrapper}>
      <Stage
        ref={stageRef}
        className={styles.stage}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <Layer>
          {/* Render persisted shapes from Yjs */}
          <ShapeLayer
            shapes={shapes}
            canEdit={canEdit}
            selectedTool={activeTool}
            onShapeUpdate={updateShape}
            onDragMove={(x, y) => setPresence({ cursor: { x, y } })}
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
