import { useAuth } from "@clerk/clerk-react";
import clsx from "clsx";

import { useToolbar } from "../hooks/useToolbar";
import styles from "./Toolbar.module.css";

type ToolbarProps = {
  className?: string;
};

export function Toolbar({ className }: ToolbarProps): React.JSX.Element {
  const { activeTool, setActiveTool } = useToolbar();
  const { isSignedIn } = useAuth();

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
    </nav>
  );
}
