/**
 * Z-Index management utilities for shape stacking order
 *
 * Operations:
 * - Bring to Front: Set zIndex to max + 1
 * - Send to Back: Set zIndex to min - 1
 * - Bring Forward: Swap with next higher zIndex
 * - Send Backward: Swap with next lower zIndex
 */

import type { Shape } from "./types";

/**
 * Get the current zIndex of a shape (defaults to 0 if not set)
 */
export function getZIndex(shape: Shape): number {
  return shape.zIndex ?? 0;
}

/**
 * Sort shapes by zIndex (ascending order, lower values render first)
 */
export function sortShapesByZIndex(shapes: Shape[]): Shape[] {
  return [...shapes].sort((a, b) => getZIndex(a) - getZIndex(b));
}

/**
 * Bring selected shapes to front (set zIndex to max + 1)
 * Maintains relative order within selection
 */
export function bringToFront(
  shapeIds: string[],
  allShapes: Shape[],
): Map<string, number> {
  if (shapeIds.length === 0) return new Map();

  const maxZIndex = Math.max(...allShapes.map(getZIndex), 0);
  const updates = new Map<string, number>();

  // Sort selected shapes by current zIndex to maintain relative order
  const selectedShapes = allShapes.filter((s) => shapeIds.includes(s.id));
  const sorted = sortShapesByZIndex(selectedShapes);

  // Assign new zIndex values starting from max + 1
  sorted.forEach((shape, index) => {
    updates.set(shape.id, maxZIndex + 1 + index);
  });

  return updates;
}

/**
 * Send selected shapes to back (set zIndex to min - 1)
 * Maintains relative order within selection
 */
export function sendToBack(
  shapeIds: string[],
  allShapes: Shape[],
): Map<string, number> {
  if (shapeIds.length === 0) return new Map();

  const minZIndex = Math.min(...allShapes.map(getZIndex), 0);
  const updates = new Map<string, number>();

  // Sort selected shapes by current zIndex to maintain relative order
  const selectedShapes = allShapes.filter((s) => shapeIds.includes(s.id));
  const sorted = sortShapesByZIndex(selectedShapes);

  // Assign new zIndex values starting from min - selectedShapes.length
  sorted.forEach((shape, index) => {
    updates.set(shape.id, minZIndex - selectedShapes.length + index);
  });

  return updates;
}

/**
 * Bring selected shapes forward one step (swap with next higher zIndex)
 * Only moves if there are shapes above the selection
 */
export function bringForward(
  shapeIds: string[],
  allShapes: Shape[],
): Map<string, number> {
  if (shapeIds.length === 0) return new Map();

  const updates = new Map<string, number>();
  const sorted = sortShapesByZIndex(allShapes);
  const selectedSet = new Set(shapeIds);

  // Find the highest selected shape
  let maxSelectedIndex = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (selectedSet.has(sorted[i].id)) {
      maxSelectedIndex = i;
      break;
    }
  }

  // If highest selected shape is already at the top, can't move forward
  if (maxSelectedIndex === sorted.length - 1) {
    return updates;
  }

  // Swap zIndex with the next higher shape
  const nextShape = sorted[maxSelectedIndex + 1];
  const currentShape = sorted[maxSelectedIndex];

  updates.set(currentShape.id, getZIndex(nextShape) + 0.5);
  // No need to update nextShape, it will be normalized on next sort

  // Normalize all zIndex values to integers
  return normalizeZIndexes(updates, allShapes);
}

/**
 * Send selected shapes backward one step (swap with next lower zIndex)
 * Only moves if there are shapes below the selection
 */
export function sendBackward(
  shapeIds: string[],
  allShapes: Shape[],
): Map<string, number> {
  if (shapeIds.length === 0) return new Map();

  const updates = new Map<string, number>();
  const sorted = sortShapesByZIndex(allShapes);
  const selectedSet = new Set(shapeIds);

  // Find the lowest selected shape
  let minSelectedIndex = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (selectedSet.has(sorted[i].id)) {
      minSelectedIndex = i;
      break;
    }
  }

  // If lowest selected shape is already at the bottom, can't move backward
  if (minSelectedIndex === 0) {
    return updates;
  }

  // Swap zIndex with the next lower shape
  const prevShape = sorted[minSelectedIndex - 1];
  const currentShape = sorted[minSelectedIndex];

  updates.set(currentShape.id, getZIndex(prevShape) - 0.5);
  // No need to update prevShape, it will be normalized on next sort

  // Normalize all zIndex values to integers
  return normalizeZIndexes(updates, allShapes);
}

/**
 * Normalize zIndex values to integers with proper spacing
 * This prevents floating-point zIndex values and ensures clean rendering order
 */
function normalizeZIndexes(
  updates: Map<string, number>,
  allShapes: Shape[],
): Map<string, number> {
  // Create a temporary map with updates applied
  const tempShapes = allShapes.map((shape) => {
    const updatedZIndex = updates.get(shape.id);
    return updatedZIndex !== undefined
      ? { ...shape, zIndex: updatedZIndex }
      : shape;
  });

  // Sort by zIndex
  const sorted = sortShapesByZIndex(tempShapes);

  // Reassign integer zIndex values with spacing of 1
  const normalized = new Map<string, number>();
  sorted.forEach((shape, index) => {
    if (updates.has(shape.id)) {
      normalized.set(shape.id, index);
    }
  });

  return normalized;
}

/**
 * Get available z-index operations for current selection
 */
export function getAvailableZIndexOperations(
  selectedShapeIds: string[],
  allShapes: Shape[],
): {
  canBringToFront: boolean;
  canSendToBack: boolean;
  canBringForward: boolean;
  canSendBackward: boolean;
} {
  if (selectedShapeIds.length === 0) {
    return {
      canBringToFront: false,
      canSendToBack: false,
      canBringForward: false,
      canSendBackward: false,
    };
  }

  const sorted = sortShapesByZIndex(allShapes);
  const selectedSet = new Set(selectedShapeIds);

  // Find min and max indices of selected shapes
  let minSelectedIndex = Number.POSITIVE_INFINITY;
  let maxSelectedIndex = Number.NEGATIVE_INFINITY;

  sorted.forEach((shape, index) => {
    if (selectedSet.has(shape.id)) {
      minSelectedIndex = Math.min(minSelectedIndex, index);
      maxSelectedIndex = Math.max(maxSelectedIndex, index);
    }
  });

  return {
    canBringToFront: maxSelectedIndex < sorted.length - 1,
    canSendToBack: minSelectedIndex > 0,
    canBringForward: maxSelectedIndex < sorted.length - 1,
    canSendBackward: minSelectedIndex > 0,
  };
}
