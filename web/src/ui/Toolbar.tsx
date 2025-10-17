import { useAuth } from "@clerk/clerk-react";
import clsx from "clsx";
import { useSelection } from "../hooks/useSelection";
import { useToolbar } from "../hooks/useToolbar";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useShapes } from "../shapes/useShapes";
import { ColorPicker } from "./ColorPicker";
import styles from "./Toolbar.module.css";

type ToolbarProps = {
  className?: string;
};

export function Toolbar({ className }: ToolbarProps): React.JSX.Element {
  const { activeTool, setActiveTool } = useToolbar();
  const { isSignedIn } = useAuth();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const { shapes, updateShape, canEdit } = useShapes();
  const { selectedShapeIds } = useSelection();

  // Get current color of selected shapes (or "mixed" if multiple colors)
  const getCurrentColor = (): string | "mixed" => {
    if (selectedShapeIds.length === 0) return "#38bdf8"; // default

    const selectedShapes = shapes.filter((s) =>
      selectedShapeIds.includes(s.id),
    );
    if (selectedShapes.length === 0) return "#38bdf8";

    const firstColor = selectedShapes[0].fill;
    const allSameColor = selectedShapes.every((s) => s.fill === firstColor);

    return allSameColor ? firstColor : "mixed";
  };

  const handleColorChange = (color: string) => {
    if (!canEdit || selectedShapeIds.length === 0) return;

    // Apply color to all selected shapes
    for (const shapeId of selectedShapeIds) {
      updateShape(shapeId, { fill: color });
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

      {selectedShapeIds.length > 0 && (
        <>
          <div className={styles.toolDivider} />
          <ColorPicker
            currentColor={getCurrentColor()}
            onColorChange={handleColorChange}
            disabled={!canEdit}
          />
        </>
      )}
    </nav>
  );
}
