/**
 * Keyboard Shortcuts Reference Panel
 * Shows all available keyboard shortcuts organized by category
 */

import { useEffect } from "react";
import styles from "./ShortcutsPanel.module.css";

type ShortcutsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ShortcutsPanel({
  isOpen,
  onClose,
}: ShortcutsPanelProps): React.JSX.Element | null {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <button
      type="button"
      className={styles.overlay}
      onClick={onClose}
      aria-label="Close shortcuts panel"
    >
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3>Tools</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>V</span>
                <span className={styles.description}>Select tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>R</span>
                <span className={styles.description}>Rectangle tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>C</span>
                <span className={styles.description}>Circle tool</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>T</span>
                <span className={styles.description}>Text tool</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Selection</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+A</span>
                <span className={styles.description}>Select all</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Escape</span>
                <span className={styles.description}>Deselect</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Shift+Click</span>
                <span className={styles.description}>
                  Multi-select (toggle)
                </span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Drag on empty</span>
                <span className={styles.description}>Lasso selection</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Navigation</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Arrow Keys</span>
                <span className={styles.description}>Move selected 10px</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Shift+Arrow</span>
                <span className={styles.description}>Move selected 1px</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Mouse Wheel</span>
                <span className={styles.description}>Zoom in/out</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Editing</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Delete/Backspace</span>
                <span className={styles.description}>Delete selected</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+D</span>
                <span className={styles.description}>Duplicate</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+C</span>
                <span className={styles.description}>Copy</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+V</span>
                <span className={styles.description}>Paste</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Z</span>
                <span className={styles.description}>Undo</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+Z</span>
                <span className={styles.description}>Redo</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Arrange</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+]</span>
                <span className={styles.description}>Bring to front</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+[</span>
                <span className={styles.description}>Send to back</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+]</span>
                <span className={styles.description}>Bring forward</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+[</span>
                <span className={styles.description}>Send backward</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Align (2+ shapes)</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+L</span>
                <span className={styles.description}>Align left</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+H</span>
                <span className={styles.description}>Align center</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+R</span>
                <span className={styles.description}>Align right</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+T</span>
                <span className={styles.description}>Align top</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+M</span>
                <span className={styles.description}>Align middle</span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+B</span>
                <span className={styles.description}>Align bottom</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Distribute (3+ shapes)</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+D</span>
                <span className={styles.description}>
                  Distribute horizontally
                </span>
              </div>
              <div className={styles.shortcut}>
                <span className={styles.key}>Cmd/Ctrl+Shift+V</span>
                <span className={styles.description}>Distribute vertically</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>AI</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>/</span>
                <span className={styles.description}>Focus AI input</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Help</h3>
            <div className={styles.shortcutList}>
              <div className={styles.shortcut}>
                <span className={styles.key}>?</span>
                <span className={styles.description}>Show shortcuts</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </button>
  );
}
