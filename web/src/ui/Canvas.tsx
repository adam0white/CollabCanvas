import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Stage, Text } from "react-konva";
import type { PresenceState } from "../hooks/usePresence";
import { useToolbar } from "../hooks/useToolbar";
import { ShapeLayer } from "../shapes/ShapeLayer";
import { createCircle, createRectangle, createText } from "../shapes/types";
import { useShapes } from "../shapes/useShapes";
import styles from "./Canvas.module.css";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_SPEED = 1.1;

type CanvasProps = {
  presence: Map<number, PresenceState>;
  setPresence: (state: Partial<PresenceState>) => void;
};

export function Canvas({
  presence,
  setPresence,
}: CanvasProps): React.JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { activeTool } = useToolbar();
  const { shapes, canEdit, createShape, updateShape, deleteShape } =
    useShapes();

  // State for rectangle creation (click-and-drag)
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRect, setNewRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // State for circle creation (click-and-drag from center)
  const [newCircle, setNewCircle] = useState<{
    x: number;
    y: number;
    radius: number;
  } | null>(null);

  // State for text creation (click to place)
  const [isCreatingText, setIsCreatingText] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [editingTextShapeId, setEditingTextShapeId] = useState<string | null>(
    null,
  );

  // State for pan and zoom
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // State for responsive canvas size
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 600 });

  // State for shape selection
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // Update canvas size based on container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.max(400, rect.width),
          height: Math.max(300, rect.height),
        });
      }
    };

    updateSize();

    // Use ResizeObserver for more reliable container size tracking
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

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

    // Clean up drawing state when switching tools (activeTool triggers this effect)
    if (activeTool) {
      setIsDrawing(false);
      setNewRect(null);
      setSelectedShapeId(null); // Deselect when switching tools
    }
  }, [activeTool]);

  // Cleanup: Destroy Stage on unmount to prevent duplicate canvas elements (especially with React StrictMode)
  useEffect(() => {
    return () => {
      const stage = stageRef.current;
      if (stage) {
        // Konva Stage cleanup - destroys all layers and removes canvas element
        stage.destroy();
      }
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field or text area
      const target = e.target as HTMLElement;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      // Skip keyboard shortcuts when user is typing in text inputs
      if (isTyping) {
        return;
      }

      // Delete selected shape with Delete or Backspace
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedShapeId &&
        canEdit
      ) {
        e.preventDefault();
        deleteShape(selectedShapeId);
        setSelectedShapeId(null);
      }

      // Deselect with Escape
      if (e.key === "Escape") {
        setSelectedShapeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedShapeId, canEdit, deleteShape]);

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

    // Deselect shape when clicking on empty canvas
    if (clickedOnEmpty && selectedShapeId) {
      setSelectedShapeId(null);
    }

    // Handle rectangle creation (for authenticated users, anywhere on canvas)
    if (activeTool === "rectangle" && canEdit) {
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

    // Handle circle creation (click+drag from center)
    if (activeTool === "circle" && canEdit && clickedOnEmpty) {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const adjustedPos = {
        x: (pos.x - position.x) / scale,
        y: (pos.y - position.y) / scale,
      };

      setIsDrawing(true);
      setNewCircle({
        x: adjustedPos.x,
        y: adjustedPos.y,
        radius: 0,
      });
      return;
    }

    // Handle text creation (click to place)
    if (activeTool === "text" && canEdit && clickedOnEmpty) {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const adjustedPos = {
        x: (pos.x - position.x) / scale,
        y: (pos.y - position.y) / scale,
      };

      setTextPosition(adjustedPos);
      setIsCreatingText(true);
      return;
    }

    // Handle panning:
    // - For authenticated users: pan when clicking on empty space in select mode
    // - For guests: always allow panning (they can't edit shapes anyway)
    const shouldPan =
      (canEdit && clickedOnEmpty && activeTool === "select") || // Authenticated: pan on empty in select mode
      (!canEdit && activeTool === "select"); // Guests: always pan in select mode

    if (shouldPan) {
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

    // Update circle being drawn
    if (isDrawing && activeTool === "circle" && newCircle) {
      const dx = adjustedPos.x - newCircle.x;
      const dy = adjustedPos.y - newCircle.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      setNewCircle({
        x: newCircle.x,
        y: newCircle.y,
        radius,
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

    // Handle end of circle drawing
    if (isDrawing && activeTool === "circle" && newCircle) {
      // Only create if circle has minimum radius
      if (newCircle.radius > 5) {
        const circle = createCircle(
          newCircle.x,
          newCircle.y,
          newCircle.radius,
          "user",
        );
        createShape(circle);
      }

      // Reset drawing state
      setIsDrawing(false);
      setNewCircle(null);
    }
  };

  const remoteCursors = Array.from(presence.values()).filter(
    (participant) => participant.cursor,
  );

  // Calculate which cursors are visible and which need edge indicators
  const visibleCursors: typeof remoteCursors = [];
  const offScreenCursors: Array<{
    participant: PresenceState;
    edgeX: number;
    edgeY: number;
    angle: number;
  }> = [];

  for (const participant of remoteCursors) {
    if (!participant.cursor) continue;

    // Convert cursor position from canvas space to screen space
    const screenX = participant.cursor.x * scale + position.x;
    const screenY = participant.cursor.y * scale + position.y;

    // Check if cursor is within visible viewport
    const isVisible =
      screenX >= 0 &&
      screenX <= canvasSize.width &&
      screenY >= 0 &&
      screenY <= canvasSize.height;

    if (isVisible) {
      visibleCursors.push(participant);
    } else {
      // Calculate edge position for indicator
      const edgeMargin = 20; // Distance from edge
      const edgeX = Math.max(
        edgeMargin,
        Math.min(canvasSize.width - edgeMargin, screenX),
      );
      const edgeY = Math.max(
        edgeMargin,
        Math.min(canvasSize.height - edgeMargin, screenY),
      );

      // Calculate angle pointing to the off-screen cursor
      const angle = Math.atan2(screenY - edgeY, screenX - edgeX);

      offScreenCursors.push({
        participant,
        edgeX: (edgeX - position.x) / scale,
        edgeY: (edgeY - position.y) / scale,
        angle,
      });
    }
  }

  // Handle text input submission
  const handleTextSubmit = () => {
    if (textInput.trim()) {
      if (editingTextShapeId) {
        // Update existing text shape
        updateShape(editingTextShapeId, { text: textInput });
      } else if (textPosition) {
        // Create new text shape
        const text = createText(
          textPosition.x,
          textPosition.y,
          textInput,
          "user",
        );
        createShape(text);
      }
    }
    setIsCreatingText(false);
    setTextInput("");
    setTextPosition(null);
    setEditingTextShapeId(null);
  };

  // Handle text input cancel
  const handleTextCancel = () => {
    setIsCreatingText(false);
    setTextInput("");
    setTextPosition(null);
    setEditingTextShapeId(null);
  };

  // Handle text shape double-click for editing
  const handleTextEdit = (
    shapeId: string,
    currentText: string,
    screenPos: { x: number; y: number },
  ) => {
    setEditingTextShapeId(shapeId);
    setTextInput(currentText);
    setTextPosition(screenPos);
    setIsCreatingText(true);
  };

  return (
    <div ref={containerRef} className={styles.canvasWrapper}>
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
        width={canvasSize.width}
        height={canvasSize.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        tabIndex={0}
        data-tool={activeTool}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        {/* Background grid layer */}
        <Layer listening={false}>
          {(() => {
            const gridSize = 20; // Grid cell size in canvas units
            const scaledGridSize = gridSize * scale;

            // Calculate visible grid range
            const startX = Math.floor(-position.x / scaledGridSize) * gridSize;
            const startY = Math.floor(-position.y / scaledGridSize) * gridSize;
            const endX =
              Math.ceil((canvasSize.width - position.x) / scaledGridSize) *
              gridSize;
            const endY =
              Math.ceil((canvasSize.height - position.y) / scaledGridSize) *
              gridSize;

            const lines = [];
            let key = 0;

            // Vertical lines
            for (let x = startX; x <= endX; x += gridSize) {
              lines.push(
                <Rect
                  key={`v-${key++}`}
                  x={x}
                  y={startY}
                  width={1 / scale}
                  height={endY - startY}
                  fill="rgba(15, 23, 42, 0.05)"
                />,
              );
            }

            // Horizontal lines
            for (let y = startY; y <= endY; y += gridSize) {
              lines.push(
                <Rect
                  key={`h-${key++}`}
                  x={startX}
                  y={y}
                  width={endX - startX}
                  height={1 / scale}
                  fill="rgba(15, 23, 42, 0.05)"
                />,
              );
            }

            return lines;
          })()}
        </Layer>

        {/* Main content layer */}
        <Layer>
          {/* Render persisted shapes from Yjs */}
          <ShapeLayer
            shapes={shapes}
            canEdit={canEdit}
            selectedTool={activeTool}
            selectedShapeId={selectedShapeId}
            onShapeSelect={setSelectedShapeId}
            onShapeUpdate={updateShape}
            onTextEdit={handleTextEdit}
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

          {/* Render circle being drawn */}
          {newCircle && isDrawing && (
            <Circle
              x={newCircle.x}
              y={newCircle.y}
              radius={newCircle.radius}
              fill="rgba(56, 189, 248, 0.3)"
              stroke="#38bdf8"
              strokeWidth={2}
              dash={[5, 5]}
            />
          )}

          {/* Render visible remote cursors with labels */}
          {visibleCursors.map((participant) => {
            if (!participant.cursor) return null;
            const labelText = participant.displayName;
            const labelWidth = labelText.length * 8 + 12; // Approximate width

            // Inverse scale to keep cursor/label at consistent size across zoom levels
            const inverseScale = 1 / scale;

            return (
              <Group
                key={`${participant.userId}-cursor`}
                x={participant.cursor.x}
                y={participant.cursor.y}
                scaleX={inverseScale}
                scaleY={inverseScale}
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

          {/* Render edge indicators for off-screen cursors */}
          {offScreenCursors.map(({ participant, edgeX, edgeY, angle }) => {
            const inverseScale = 1 / scale;
            const arrowSize = 12;

            return (
              <Group
                key={`${participant.userId}-edge-indicator`}
                x={edgeX}
                y={edgeY}
                rotation={(angle * 180) / Math.PI}
                scaleX={inverseScale}
                scaleY={inverseScale}
                opacity={0.9}
              >
                {/* Arrow pointer */}
                <Rect
                  x={0}
                  y={-arrowSize / 2}
                  width={arrowSize * 1.5}
                  height={arrowSize}
                  fill={participant.color}
                  cornerRadius={2}
                  shadowColor="rgba(0, 0, 0, 0.3)"
                  shadowBlur={4}
                />
                {/* Arrow tip */}
                <Rect
                  x={arrowSize * 1.5}
                  y={0}
                  width={arrowSize / 2}
                  height={arrowSize / 2}
                  offsetX={arrowSize / 4}
                  offsetY={arrowSize / 4}
                  rotation={45}
                  fill={participant.color}
                  shadowColor="rgba(0, 0, 0, 0.3)"
                  shadowBlur={4}
                />
                {/* User initials on the indicator */}
                <Text
                  x={4}
                  y={-4}
                  text={participant.displayName.substring(0, 2).toUpperCase()}
                  fontSize={8}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontStyle="bold"
                  fill="#fff"
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Text input overlay */}
      {isCreatingText && textPosition && (
        <div
          className={styles.textInputOverlay}
          style={{
            position: "absolute",
            left: `${textPosition.x * scale + position.x}px`,
            top: `${textPosition.y * scale + position.y}px`,
            zIndex: 1000,
          }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleTextSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleTextCancel();
              }
            }}
            onBlur={handleTextSubmit}
            placeholder="Enter text..."
            className={styles.textInput}
          />
        </div>
      )}
    </div>
  );
}
