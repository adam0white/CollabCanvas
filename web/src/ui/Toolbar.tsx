import clsx from "clsx";
import { useState } from "react";

import styles from "./Toolbar.module.css";

type Tool = "select" | "rectangle";

type ToolbarProps = {
  className?: string;
};

export function Toolbar({ className }: ToolbarProps): JSX.Element {
  const [activeTool, setActiveTool] = useState<Tool>("select");

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);
  };

  return (
    <nav className={clsx(styles.toolbar, className)} aria-label="Canvas tools">
      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonActive]: activeTool === "select",
        })}
        onClick={() => handleToolChange("select")}
      >
        <span aria-hidden>🖱️</span>
        Select
      </button>

      <button
        type="button"
        className={clsx(styles.toolButton, {
          [styles.toolButtonActive]: activeTool === "rectangle",
        })}
        onClick={() => handleToolChange("rectangle")}
      >
        <span aria-hidden>▭</span>
        Rectangle
      </button>
    </nav>
  );
}
