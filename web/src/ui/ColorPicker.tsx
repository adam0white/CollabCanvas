/**
 * Color Picker Component
 * 
 * Features:
 * - Standard color palette
 * - Custom hex input
 * - Recent colors (localStorage persistence)
 * - Multi-select support with "mixed" indicator
 */

import { useEffect, useRef, useState } from "react";
import { THROTTLE } from "../config/constants";
import styles from "./ColorPicker.module.css";

type ColorPickerProps = {
  currentColor: string | "mixed";
  onColorChange: (color: string) => void;
  disabled?: boolean;
};

const STANDARD_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#64748b", // slate
  "#000000", // black
  "#ffffff", // white
];

const RECENT_COLORS_KEY = "collabcanvas-recent-colors";
const MAX_RECENT_COLORS = 8;

export function ColorPicker({
  currentColor,
  onColorChange,
  disabled = false,
}: ColorPickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState("");
  const [customColorError, setCustomColorError] = useState("");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const lastColorChangeRef = useRef(0);

  // Load recent colors from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_COLORS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentColors(parsed.slice(0, MAX_RECENT_COLORS));
        }
      }
    } catch (error) {
      console.error("Failed to load recent colors:", error);
    }
  }, []);

  // Close picker when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleColorSelect = (color: string) => {
    // Throttle color changes
    const now = performance.now();
    if (now - lastColorChangeRef.current < THROTTLE.COLOR_CHANGE_MS) {
      return;
    }
    lastColorChangeRef.current = now;

    onColorChange(color);
    addToRecentColors(color);
  };

  const addToRecentColors = (color: string) => {
    try {
      // Remove if already in recent colors
      const updated = [color, ...recentColors.filter((c) => c !== color)].slice(
        0,
        MAX_RECENT_COLORS,
      );
      setRecentColors(updated);
      localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save recent color:", error);
    }
  };

  const handleCustomColorSubmit = () => {
    const trimmed = customColor.trim();
    if (!trimmed) return;

    // Validate hex color
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexPattern.test(trimmed)) {
      setCustomColorError("Please enter a valid hex color (e.g., #FF5733)");
      return;
    }

    handleColorSelect(trimmed);
    setCustomColor("");
    setCustomColorError("");
  };

  const handleCustomColorChange = (value: string) => {
    setCustomColor(value);
    // Clear error when user starts typing
    if (customColorError) {
      setCustomColorError("");
    }
  };

  const displayColor = currentColor === "mixed" ? "#64748b" : currentColor;

  return (
    <div className={styles.container} ref={pickerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        title={currentColor === "mixed" ? "Multiple colors selected" : currentColor}
      >
        <div
          className={styles.colorSwatch}
          style={{ background: displayColor }}
        />
        {currentColor === "mixed" && <span className={styles.mixedLabel}>Mixed</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {/* Standard palette */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Colors</h4>
            <div className={styles.palette}>
              {STANDARD_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={styles.colorButton}
                  style={{ background: color }}
                  onClick={() => handleColorSelect(color)}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Recent colors */}
          {recentColors.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Recent</h4>
              <div className={styles.palette}>
                {recentColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={styles.colorButton}
                    style={{ background: color }}
                    onClick={() => handleColorSelect(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom color input */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Custom</h4>
            <div className={styles.customInput}>
              <input
                type="text"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCustomColorSubmit();
                  }
                }}
                placeholder="#FF5733"
                className={`${styles.hexInput} ${customColorError ? styles.hexInputError : ""}`}
              />
              <button
                type="button"
                onClick={handleCustomColorSubmit}
                className={styles.applyButton}
              >
                Apply
              </button>
            </div>
            {customColorError && (
              <div className={styles.errorMessage}>{customColorError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
