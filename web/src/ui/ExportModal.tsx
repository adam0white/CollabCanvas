/**
 * Export Modal - Allows exporting canvas or selected shapes as PNG or SVG
 *
 * Features:
 * - Export entire canvas or selected shapes only
 * - PNG format with resolution options (1x, 2x, 4x)
 * - SVG format for vector graphics
 * - Custom filename input
 */

import { useEffect, useState } from "react";
import styles from "./ExportModal.module.css";

export type ExportFormat = "png" | "svg";
export type ExportScope = "canvas" | "selection";
export type ExportQuality = 1 | 2 | 4;

type ExportModalProps = {
  hasSelection: boolean;
  onClose: () => void;
  onExport: (options: {
    format: ExportFormat;
    scope: ExportScope;
    quality: ExportQuality;
    filename: string;
  }) => void;
};

export function ExportModal({
  hasSelection,
  onClose,
  onExport,
}: ExportModalProps): React.JSX.Element | null {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scope, setScope] = useState<ExportScope>("canvas");
  const [quality, setQuality] = useState<ExportQuality>(2);
  const [filename, setFilename] = useState("canvas");

  // Update filename extension when format changes
  useEffect(() => {
    if (filename.endsWith(".png") || filename.endsWith(".svg")) {
      setFilename(filename.replace(/\.(png|svg)$/, `.${format}`));
    } else if (!filename.includes(".")) {
      setFilename(`${filename}.${format}`);
    }
  }, [format, filename]);

  // Reset scope to canvas if selection is cleared
  useEffect(() => {
    if (!hasSelection && scope === "selection") {
      setScope("canvas");
    }
  }, [hasSelection, scope]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleExport = () => {
    onExport({ format, scope, quality, filename });
    onClose();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: Modal overlay pattern requires clickable div
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="button"
      tabIndex={0}
      aria-label="Close export modal"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h2>Export Canvas</h2>
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
          <div className={styles.section}>
            <h3>Format</h3>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="format"
                  value="png"
                  checked={format === "png"}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                />
                <span>PNG (Raster Image)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="format"
                  value="svg"
                  checked={format === "svg"}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                />
                <span>SVG (Vector Graphic)</span>
              </label>
            </div>
          </div>

          <div className={styles.section}>
            <h3>Scope</h3>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="scope"
                  value="canvas"
                  checked={scope === "canvas"}
                  onChange={(e) => setScope(e.target.value as ExportScope)}
                />
                <span>Entire Canvas</span>
              </label>
              <label
                className={
                  hasSelection
                    ? styles.radioLabel
                    : `${styles.radioLabel} ${styles.disabled}`
                }
              >
                <input
                  type="radio"
                  name="scope"
                  value="selection"
                  checked={scope === "selection"}
                  onChange={(e) => setScope(e.target.value as ExportScope)}
                  disabled={!hasSelection}
                />
                <span>
                  Selected Shapes Only{" "}
                  {!hasSelection && <em>(no selection)</em>}
                </span>
              </label>
            </div>
          </div>

          {format === "png" && (
            <div className={styles.section}>
              <h3>Quality</h3>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="quality"
                    value="1"
                    checked={quality === 1}
                    onChange={(e) =>
                      setQuality(Number(e.target.value) as ExportQuality)
                    }
                  />
                  <span>1x (Standard)</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="quality"
                    value="2"
                    checked={quality === 2}
                    onChange={(e) =>
                      setQuality(Number(e.target.value) as ExportQuality)
                    }
                  />
                  <span>2x (High Definition)</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="quality"
                    value="4"
                    checked={quality === 4}
                    onChange={(e) =>
                      setQuality(Number(e.target.value) as ExportQuality)
                    }
                  />
                  <span>4x (Ultra HD)</span>
                </label>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h3>Filename</h3>
            <input
              type="text"
              className={styles.filenameInput}
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Enter filename..."
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className={styles.exportButton}
            disabled={!filename.trim()}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
