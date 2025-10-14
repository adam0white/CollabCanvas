import clsx from "clsx";

import { useToolbar } from "../hooks/useToolbar";
import styles from "./Toolbar.module.css";

type ToolbarProps = {
  className?: string;
};

export function Toolbar({ className }: ToolbarProps): JSX.Element {
  const { activeTool, setActiveTool } = useToolbar();

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
        })}
        onClick={() => setActiveTool("rectangle")}
      >
        <span aria-hidden>▭</span>
        Rectangle
      </button>
    </nav>
  );
}
