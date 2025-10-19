import { useUser } from "@clerk/clerk-react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Stage, Text } from "react-konva";
import { useLocking } from "../hooks/useLocking";
import type { PresenceState } from "../hooks/usePresence";
import { useSelection } from "../hooks/useSelection";
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
  getShapeBounds,
} from "../shapes/alignment";
import { ShapeLayer } from "../shapes/ShapeLayer";
import {
  createCircle,
  createRectangle,
  createText,
  isRectangle,
  type Shape,
} from "../shapes/types";
import { useShapes } from "../shapes/useShapes";
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
} from "../shapes/zindex";
import {
  calculateViewportBounds,
  filterVisibleShapes,
  getViewportStats,
} from "../utils/viewport";
import styles from "./Canvas.module.css";
import type { ExportFormat, ExportQuality, ExportScope } from "./ExportModal";
import { ExportModal } from "./ExportModal";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_SPEED = 1.1;

type CanvasProps = {
  presence: Map<number, PresenceState>;
  setPresence: (state: Partial<PresenceState>) => void;
  defaultFillColor?: string;
};

export function Canvas({
  presence,
  setPresence,
  defaultFillColor: propDefaultFillColor = "#38bdf8",
}: CanvasProps): React.JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { activeTool, setActiveTool } = useToolbar();
  const {
    shapes,
    canEdit,
    createShape,
    updateShape,
    batchDeleteShapes,
    batchUpdateShapes,
  } = useShapes();
  const { user } = useUser();
  const userId = user?.id ?? "guest";
  const locking = useLocking(userId);
  const undoRedo = useUndoRedo();
  const { selectedShapeIds, setSelectedShapeIds } = useSelection();
  const snap = useSnapToGrid();

  // State for rectangle creation (click-and-drag)
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRect, setNewRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // State for export modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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

  // State for lasso selection
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isLassoSelecting, setIsLassoSelecting] = useState(false);

  // State for copy/paste
  const [clipboard, setClipboard] = useState<Shape[]>([]);
  const [pasteCount, setPasteCount] = useState(0);

  // Use prop for default fill color (controlled by App.tsx via Toolbar)
  const defaultFillColor = propDefaultFillColor;

  // Update locks when selection changes
  useEffect(() => {
    if (canEdit) {
      locking.updateLocks(selectedShapeIds);
    }
  }, [selectedShapeIds, canEdit, locking]);

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
      setSelectedShapeIds([]); // Deselect when switching tools
    }
  }, [activeTool, setSelectedShapeIds]);

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
      // Check if user is typing in an input field, text area, or AI panel
      const target = e.target as HTMLElement;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.closest('[class*="AIPanel"]') !== null; // Also check if inside AI panel

      // Skip keyboard shortcuts when user is typing in text inputs or AI panel
      // Allow native copy/paste in text fields
      if (isTyping) {
        return;
      }

      // Delete selected shapes with Delete or Backspace
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedShapeIds.length > 0 &&
        canEdit
      ) {
        e.preventDefault();
        // Batch delete for performance (single Yjs transaction)
        batchDeleteShapes(selectedShapeIds);
        setSelectedShapeIds([]);
      }

      // Deselect with Escape
      if (e.key === "Escape") {
        setSelectedShapeIds([]);
      }

      // Select all with Cmd+A / Ctrl+A
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && canEdit) {
        e.preventDefault();
        setSelectedShapeIds(shapes.map((s) => s.id));
      }

      // Duplicate with Cmd+D / Ctrl+D
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "d" &&
        canEdit &&
        selectedShapeIds.length > 0
      ) {
        e.preventDefault();

        // Clone selected shapes with new IDs and offset position
        const duplicatedShapeIds: string[] = [];
        const DUPLICATE_OFFSET = 20;

        for (const shapeId of selectedShapeIds) {
          const originalShape = shapes.find((s) => s.id === shapeId);
          if (!originalShape) continue;

          // Create duplicate with new ID and offset position
          const duplicateShape: Shape = {
            ...originalShape,
            id: crypto.randomUUID(),
            x: originalShape.x + DUPLICATE_OFFSET,
            y: originalShape.y + DUPLICATE_OFFSET,
            createdAt: Date.now(),
          };

          createShape(duplicateShape);
          duplicatedShapeIds.push(duplicateShape.id);
        }

        // Select the duplicated shapes
        setSelectedShapeIds(duplicatedShapeIds);
      }

      // Undo with Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && canEdit) {
        e.preventDefault();
        undoRedo.undo();
      }

      // Redo with Cmd+Shift+Z / Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey && canEdit) {
        e.preventDefault();
        undoRedo.redo();
      }

      // Tool switching shortcuts
      if (e.key === "v" && canEdit) {
        e.preventDefault();
        setActiveTool("select");
      }

      if (e.key === "r" && canEdit) {
        e.preventDefault();
        setActiveTool("rectangle");
      }

      if (e.key === "c" && canEdit) {
        e.preventDefault();
        setActiveTool("circle");
      }

      if (e.key === "t" && canEdit) {
        e.preventDefault();
        setActiveTool("text");
      }

      // Arrow key navigation for selected shapes
      if (
        selectedShapeIds.length > 0 &&
        canEdit &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();

        const moveDistance = e.shiftKey ? 1 : 10; // 1px with Shift, 10px without
        let dx = 0;
        let dy = 0;

        if (e.key === "ArrowLeft") dx = -moveDistance;
        if (e.key === "ArrowRight") dx = moveDistance;
        if (e.key === "ArrowUp") dy = -moveDistance;
        if (e.key === "ArrowDown") dy = moveDistance;

        // Move all selected shapes
        for (const shapeId of selectedShapeIds) {
          const shape = shapes.find((s) => s.id === shapeId);
          if (shape) {
            updateShape(shapeId, {
              x: shape.x + dx,
              y: shape.y + dy,
            });
          }
        }
      }

      // Copy with Cmd+C / Ctrl+C
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "c" &&
        canEdit &&
        selectedShapeIds.length > 0
      ) {
        e.preventDefault();

        // Copy selected shapes to clipboard
        const selectedShapes = shapes.filter((s) =>
          selectedShapeIds.includes(s.id),
        );
        setClipboard(selectedShapes);
        setPasteCount(0); // Reset paste count for new copy
      }

      // Paste with Cmd+V / Ctrl+V
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "v" &&
        canEdit &&
        clipboard.length > 0
      ) {
        e.preventDefault();

        // Calculate offset (cumulative for multiple pastes)
        const PASTE_OFFSET = 20;
        const offsetMultiplier = pasteCount + 1;
        const offsetX = PASTE_OFFSET * offsetMultiplier;
        const offsetY = PASTE_OFFSET * offsetMultiplier;

        // Paste shapes with new IDs and offset
        const pastedShapeIds: string[] = [];

        for (const originalShape of clipboard) {
          const pastedShape: Shape = {
            ...originalShape,
            id: crypto.randomUUID(),
            x: originalShape.x + offsetX,
            y: originalShape.y + offsetY,
            createdAt: Date.now(),
          };

          createShape(pastedShape);
          pastedShapeIds.push(pastedShape.id);
        }

        // Select pasted shapes
        setSelectedShapeIds(pastedShapeIds);
        setPasteCount(pasteCount + 1);
      }

      // Z-Index shortcuts (Cmd+] / Cmd+[ / Cmd+Shift+] / Cmd+Shift+[)
      if (
        (e.metaKey || e.ctrlKey) &&
        selectedShapeIds.length > 0 &&
        canEdit
      ) {
        // Bring to Front: Cmd+]
        if (e.key === "]" && !e.shiftKey) {
          e.preventDefault();
          const zIndexUpdates = bringToFront(selectedShapeIds, shapes);
          for (const [id, zIndex] of zIndexUpdates) {
            updateShape(id, { zIndex });
          }
        }

        // Send to Back: Cmd+[
        if (e.key === "[" && !e.shiftKey) {
          e.preventDefault();
          const zIndexUpdates = sendToBack(selectedShapeIds, shapes);
          for (const [id, zIndex] of zIndexUpdates) {
            updateShape(id, { zIndex });
          }
        }

        // Bring Forward: Cmd+Shift+]
        if (e.key === "]" && e.shiftKey) {
          e.preventDefault();
          const zIndexUpdates = bringForward(selectedShapeIds, shapes);
          for (const [id, zIndex] of zIndexUpdates) {
            updateShape(id, { zIndex });
          }
        }

        // Send Backward: Cmd+Shift+[
        if (e.key === "[" && e.shiftKey) {
          e.preventDefault();
          const zIndexUpdates = sendBackward(selectedShapeIds, shapes);
          for (const [id, zIndex] of zIndexUpdates) {
            updateShape(id, { zIndex });
          }
        }
      }

      // Alignment shortcuts (Cmd+Shift+L/H/R/T/M/B/D/V)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        selectedShapeIds.length >= 2 &&
        canEdit
      ) {
        const selectedShapes = shapes.filter((s) =>
          selectedShapeIds.includes(s.id),
        );

        // Align Left: Cmd+Shift+L
        if (e.key === "L") {
          e.preventDefault();
          const updates = alignLeft(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }

        // Align Center: Cmd+Shift+H
        if (e.key === "H") {
          e.preventDefault();
          const updates = alignCenter(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }

        // Align Right: Cmd+Shift+R
        if (e.key === "R") {
          e.preventDefault();
          const updates = alignRight(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }

        // Align Top: Cmd+Shift+T
        if (e.key === "T") {
          e.preventDefault();
          const updates = alignTop(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }

        // Align Middle: Cmd+Shift+M
        if (e.key === "M") {
          e.preventDefault();
          const updates = alignMiddle(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }

        // Align Bottom: Cmd+Shift+B
        if (e.key === "B") {
          e.preventDefault();
          const updates = alignBottom(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }

        // Distribute Horizontally: Cmd+Shift+D
        if (e.key === "D" && selectedShapeIds.length >= 3) {
          e.preventDefault();
          const updates = distributeHorizontally(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }

        // Distribute Vertically: Cmd+Shift+V
        if (e.key === "V" && selectedShapeIds.length >= 3) {
          e.preventDefault();
          const updates = distributeVertically(selectedShapes);
          for (const [id, shapeUpdates] of updates) {
            updateShape(id, shapeUpdates);
          }
        }
      }

      // Export: Cmd+E
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        setIsExportModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedShapeIds,
    canEdit,
    shapes,
    createShape,
    undoRedo,
    setActiveTool,
    updateShape,
    clipboard,
    pasteCount,
    batchDeleteShapes,
    setSelectedShapeIds,
  ]);

  // Export handler
  const handleExport = (
    format: ExportFormat,
    scope: ExportScope,
    quality: ExportQuality,
    filename: string,
  ) => {
    const stage = stageRef.current;
    if (!stage) return;

    let dataURL: string;

    if (scope === "selection" && selectedShapeIds.length > 0) {
      // Export selected shapes only
      const selectedShapes = shapes.filter((s) =>
        selectedShapeIds.includes(s.id),
      );

      // Calculate bounding box
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const shape of selectedShapes) {
        const bounds = getShapeBounds(shape);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      }

      const width = maxX - minX;
      const height = maxY - minY;

      // Export cropped region
      dataURL = stage.toDataURL({
        x: minX,
        y: minY,
        width,
        height,
        pixelRatio: quality === "1x" ? 1 : quality === "2x" ? 2 : 4,
      });
    } else {
      // Export entire canvas
      dataURL = stage.toDataURL({
        pixelRatio: quality === "1x" ? 1 : quality === "2x" ? 2 : 4,
      });
    }

    // Trigger download
    const link = document.createElement("a");
    link.download = `${filename}.${format}`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsExportModalOpen(false);
  };

  // Expose export modal opener to window for Toolbar
  useEffect(() => {
    (window as { openExportModal?: () => void }).openExportModal = () => {
      setIsExportModalOpen(true);
    };

    return () => {
      delete (window as { openExportModal?: () => void }).openExportModal;
    };
  }, []);

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

    // Deselect shapes when clicking on empty canvas (unless shift is held for lasso)
    if (clickedOnEmpty && selectedShapeIds.length > 0 && !e.evt.shiftKey) {
      setSelectedShapeIds([]);
    }

    // Handle lasso selection (drag on empty canvas in select mode)
    if (activeTool === "select" && canEdit && clickedOnEmpty) {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const adjustedPos = {
        x: (pos.x - position.x) / scale,
        y: (pos.y - position.y) / scale,
      };

      setIsLassoSelecting(true);
      setLassoStart(adjustedPos);
      setLassoEnd(adjustedPos);
      return;
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
    // Allow creation anywhere, even on top of existing shapes
    if (activeTool === "circle" && canEdit) {
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
    // Allow creation anywhere, even on top of existing shapes
    if (activeTool === "text" && canEdit) {
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
    // - Middle mouse button: pan for everyone
    // - For guests: also allow left-click panning anywhere (since they can't edit)
    const isMiddleClick = e.evt.button === 1;
    const shouldPan =
      (isMiddleClick && activeTool === "select") || // Middle mouse for everyone
      (!canEdit && activeTool === "select"); // Guests: left-click anywhere

    if (shouldPan) {
      e.evt.preventDefault(); // Prevent default middle-click behavior
      setIsPanning(true);
      stage.container().style.cursor = "grabbing";
      return;
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

    // Handle lasso selection
    if (isLassoSelecting && lassoStart) {
      setLassoEnd(adjustedPos);
      return;
    }

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

    // Handle end of lasso selection
    if (isLassoSelecting && lassoStart && lassoEnd) {
      // Calculate selection rectangle bounds
      const minX = Math.min(lassoStart.x, lassoEnd.x);
      const maxX = Math.max(lassoStart.x, lassoEnd.x);
      const minY = Math.min(lassoStart.y, lassoEnd.y);
      const maxY = Math.max(lassoStart.y, lassoEnd.y);

      // Find shapes whose centers are inside the lasso rectangle
      const selectedIds = shapes
        .filter((shape) => {
          // Calculate shape center based on type
          let centerX = shape.x;
          let centerY = shape.y;

          if (isRectangle(shape)) {
            centerX += shape.width / 2;
            centerY += shape.height / 2;
          }
          // Circle and text are already centered at x,y

          return (
            centerX >= minX &&
            centerX <= maxX &&
            centerY >= minY &&
            centerY <= maxY
          );
        })
        .map((s) => s.id);

      // If Shift is held, add to existing selection, otherwise replace
      if (e.evt.shiftKey) {
        setSelectedShapeIds([
          ...new Set([...selectedShapeIds, ...selectedIds]),
        ]);
      } else {
        setSelectedShapeIds(selectedIds);
      }

      // Reset lasso state
      setIsLassoSelecting(false);
      setLassoStart(null);
      setLassoEnd(null);
      return;
    }

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

        // Create the rectangle shape with current default color
        const rect = createRectangle(
          x,
          y,
          normalizedWidth,
          normalizedHeight,
          "user",
        );
        // Override default color with selected color
        rect.fill = defaultFillColor;
        createShape(rect);

        // Auto-select the newly created shape
        setSelectedShapeIds([rect.id]);
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
        // Override default color with selected color
        circle.fill = defaultFillColor;
        createShape(circle);

        // Auto-select the newly created shape
        setSelectedShapeIds([circle.id]);
      }

      // Reset drawing state
      setIsDrawing(false);
      setNewCircle(null);
    }
  };

  // Viewport culling: Only render shapes visible in current viewport
  // This dramatically improves performance with 500+ shapes
  const viewportBounds = useMemo(
    () =>
      calculateViewportBounds(
        canvasSize.width,
        canvasSize.height,
        scale,
        position,
      ),
    [canvasSize.width, canvasSize.height, scale, position],
  );

  const visibleShapes = useMemo(() => {
    // Always render selected shapes even if off-screen (for transformer)
    const selectedShapes = shapes.filter((s) =>
      selectedShapeIds.includes(s.id),
    );
    const unselectedShapes = shapes.filter(
      (s) => !selectedShapeIds.includes(s.id),
    );

    // Filter unselected shapes by viewport
    const visibleUnselected = filterVisibleShapes(
      unselectedShapes,
      viewportBounds,
    );

    // Combine selected and visible shapes
    return [...selectedShapes, ...visibleUnselected];
  }, [shapes, selectedShapeIds, viewportBounds]);

  // Log viewport culling stats in development (helps with performance debugging)
  useEffect(() => {
    if (import.meta.env.DEV && shapes.length > 50) {
      const stats = getViewportStats(shapes.length, visibleShapes.length);
      console.debug(
        `[Viewport Culling] ${stats.visibleShapes}/${stats.totalShapes} shapes visible (${stats.cullPercentage}% culled)`,
      );
    }
  }, [shapes.length, visibleShapes.length]);

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
    const trimmedText = textInput.trim();

    if (trimmedText) {
      // Only create/update if there's actual text
      if (editingTextShapeId) {
        // Update existing text shape
        updateShape(editingTextShapeId, { text: trimmedText });
        // Keep the edited shape selected
        setSelectedShapeIds([editingTextShapeId]);
      } else if (textPosition) {
        // Create new text shape with default color
        const text = createText(
          textPosition.x,
          textPosition.y,
          trimmedText,
          "user",
        );
        text.fill = defaultFillColor;
        createShape(text);

        // Auto-select the newly created text shape
        setSelectedShapeIds([text.id]);
      }
    }
    // Always close the input, even if empty (don't create empty text shapes)
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
        {/* Performance: listening=false, perfectDrawEnabled=false for static grid */}
        <Layer listening={false} perfectDrawEnabled={false}>
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
                  listening={false}
                  perfectDrawEnabled={false}
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
                  listening={false}
                  perfectDrawEnabled={false}
                />,
              );
            }

            return lines;
          })()}
        </Layer>

        {/* Main content layer */}
        <Layer>
          {/* Render persisted shapes from Yjs (with viewport culling) */}
          <ShapeLayer
            shapes={visibleShapes}
            canEdit={canEdit}
            selectedTool={activeTool}
            selectedShapeIds={selectedShapeIds}
            userId={userId}
            locking={locking}
            snapToGrid={snap.snapEnabled ? snap.snapPoint : undefined}
            onShapeUpdate={updateShape}
            onBatchShapeUpdate={batchUpdateShapes}
            onShapeSelect={(shapeId, addToSelection) => {
              // Check if shape is locked by another user
              if (locking.isShapeLocked(shapeId, userId)) {
                // Don't allow selection of locked shapes
                return;
              }

              if (addToSelection) {
                // Shift+Click: toggle shape in/out of selection
                if (selectedShapeIds.includes(shapeId)) {
                  setSelectedShapeIds(
                    selectedShapeIds.filter((id) => id !== shapeId),
                  );
                } else {
                  setSelectedShapeIds([...selectedShapeIds, shapeId]);
                }
              } else {
                // Normal click: exclusive selection
                setSelectedShapeIds([shapeId]);
              }
            }}
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

          {/* Render lasso selection rectangle */}
          {isLassoSelecting && lassoStart && lassoEnd && (
            <Rect
              x={Math.min(lassoStart.x, lassoEnd.x)}
              y={Math.min(lassoStart.y, lassoEnd.y)}
              width={Math.abs(lassoEnd.x - lassoStart.x)}
              height={Math.abs(lassoEnd.y - lassoStart.y)}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={2 / scale}
              dash={[10 / scale, 5 / scale]}
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

      {/* Export Modal */}
      {isExportModalOpen && (
        <ExportModal
          onClose={() => setIsExportModalOpen(false)}
          onExport={handleExport}
          hasSelection={selectedShapeIds.length > 0}
        />
      )}
    </div>
  );
}
