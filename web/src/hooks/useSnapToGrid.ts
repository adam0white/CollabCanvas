/**
 * Snap-to-grid hook for precise shape positioning
 */

import { useState } from "react";

export type GridSize = 10 | 20 | 50;

export function useSnapToGrid() {
  const [snapEnabled, setSnapEnabled] = useState(() => {
    const stored = localStorage.getItem("snapToGrid");
    return stored ? JSON.parse(stored) : false;
  });

  const [gridSize, setGridSize] = useState<GridSize>(() => {
    const stored = localStorage.getItem("gridSize");
    return stored ? (Number.parseInt(stored, 10) as GridSize) : 20;
  });

  const toggleSnap = () => {
    setSnapEnabled((prev: boolean) => {
      const newValue = !prev;
      localStorage.setItem("snapToGrid", JSON.stringify(newValue));
      return newValue;
    });
  };

  const updateGridSize = (size: GridSize) => {
    setGridSize(size);
    localStorage.setItem("gridSize", String(size));
  };

  /**
   * Snap a coordinate to the nearest grid point
   */
  const snapToGrid = (value: number): number => {
    if (!snapEnabled) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  /**
   * Snap a point (x, y) to the nearest grid point
   */
  const snapPoint = (x: number, y: number): { x: number; y: number } => {
    return {
      x: snapToGrid(x),
      y: snapToGrid(y),
    };
  };

  return {
    snapEnabled,
    gridSize,
    toggleSnap,
    updateGridSize,
    snapToGrid,
    snapPoint,
  };
}
