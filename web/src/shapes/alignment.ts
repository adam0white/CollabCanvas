/**
 * Shape alignment and distribution utilities
 *
 * Operations:
 * - Horizontal alignment: left, center, right
 * - Vertical alignment: top, middle, bottom
 * - Distribution: even spacing horizontally or vertically
 *
 * All operations work on multiple selected shapes and maintain shape types
 */

import type { Shape } from "./types";
import { isCircle, isRectangle, isText } from "./types";

/**
 * Get bounding box for a shape (handles all shape types)
 */
export function getShapeBounds(shape: Shape): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
} {
  if (isRectangle(shape)) {
    const left = shape.x;
    const top = shape.y;
    const width = shape.width;
    const height = shape.height;
    return {
      left,
      right: left + width,
      top,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
      width,
      height,
    };
  }

  if (isCircle(shape)) {
    const centerX = shape.x;
    const centerY = shape.y;
    const radius = shape.radius;
    return {
      left: centerX - radius,
      right: centerX + radius,
      top: centerY - radius,
      bottom: centerY + radius,
      centerX,
      centerY,
      width: radius * 2,
      height: radius * 2,
    };
  }

  if (isText(shape)) {
    // Text shapes: approximate bounds based on fontSize
    const left = shape.x;
    const top = shape.y;
    // Estimate width: if width is set, use it; otherwise estimate from text length
    const width = shape.width ?? shape.text.length * shape.fontSize * 0.6;
    const height = shape.fontSize * 1.2; // Line height approximation
    return {
      left,
      right: left + width,
      top,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
      width,
      height,
    };
  }

  // TypeScript exhaustive check - this should never be reached
  const _exhaustiveCheck: never = shape;
  throw new Error(`Unknown shape type: ${(_exhaustiveCheck as Shape).type}`);
}

/**
 * Get bounding box for multiple shapes (the enclosing rectangle)
 */
export function getGroupBounds(
  shapes: Shape[],
): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
} {
  if (shapes.length === 0) {
    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
    };
  }

  const bounds = shapes.map(getShapeBounds);
  const left = Math.min(...bounds.map((b) => b.left));
  const right = Math.max(...bounds.map((b) => b.right));
  const top = Math.min(...bounds.map((b) => b.top));
  const bottom = Math.max(...bounds.map((b) => b.bottom));

  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Align shapes to the left edge of the leftmost shape
 */
export function alignLeft(shapes: Shape[]): Map<string, Partial<Shape>> {
  if (shapes.length < 2) return new Map();

  const bounds = shapes.map((s) => ({ shape: s, bounds: getShapeBounds(s) }));
  const leftmostX = Math.min(...bounds.map((b) => b.bounds.left));

  const updates = new Map<string, Partial<Shape>>();

  for (const { shape, bounds: shapeBounds } of bounds) {
    const offsetX = leftmostX - shapeBounds.left;
    if (offsetX !== 0) {
      updates.set(shape.id, { x: shape.x + offsetX });
    }
  }

  return updates;
}

/**
 * Align shapes to the horizontal center of the group
 */
export function alignCenter(shapes: Shape[]): Map<string, Partial<Shape>> {
  if (shapes.length < 2) return new Map();

  const groupBounds = getGroupBounds(shapes);
  const groupCenterX = groupBounds.centerX;

  const updates = new Map<string, Partial<Shape>>();

  for (const shape of shapes) {
    const shapeBounds = getShapeBounds(shape);
    const offsetX = groupCenterX - shapeBounds.centerX;
    if (offsetX !== 0) {
      updates.set(shape.id, { x: shape.x + offsetX });
    }
  }

  return updates;
}

/**
 * Align shapes to the right edge of the rightmost shape
 */
export function alignRight(shapes: Shape[]): Map<string, Partial<Shape>> {
  if (shapes.length < 2) return new Map();

  const bounds = shapes.map((s) => ({ shape: s, bounds: getShapeBounds(s) }));
  const rightmostX = Math.max(...bounds.map((b) => b.bounds.right));

  const updates = new Map<string, Partial<Shape>>();

  for (const { shape, bounds: shapeBounds } of bounds) {
    const offsetX = rightmostX - shapeBounds.right;
    if (offsetX !== 0) {
      updates.set(shape.id, { x: shape.x + offsetX });
    }
  }

  return updates;
}

/**
 * Align shapes to the top edge of the topmost shape
 */
export function alignTop(shapes: Shape[]): Map<string, Partial<Shape>> {
  if (shapes.length < 2) return new Map();

  const bounds = shapes.map((s) => ({ shape: s, bounds: getShapeBounds(s) }));
  const topmostY = Math.min(...bounds.map((b) => b.bounds.top));

  const updates = new Map<string, Partial<Shape>>();

  for (const { shape, bounds: shapeBounds } of bounds) {
    const offsetY = topmostY - shapeBounds.top;
    if (offsetY !== 0) {
      updates.set(shape.id, { y: shape.y + offsetY });
    }
  }

  return updates;
}

/**
 * Align shapes to the vertical middle of the group
 */
export function alignMiddle(shapes: Shape[]): Map<string, Partial<Shape>> {
  if (shapes.length < 2) return new Map();

  const groupBounds = getGroupBounds(shapes);
  const groupCenterY = groupBounds.centerY;

  const updates = new Map<string, Partial<Shape>>();

  for (const shape of shapes) {
    const shapeBounds = getShapeBounds(shape);
    const offsetY = groupCenterY - shapeBounds.centerY;
    if (offsetY !== 0) {
      updates.set(shape.id, { y: shape.y + offsetY });
    }
  }

  return updates;
}

/**
 * Align shapes to the bottom edge of the bottommost shape
 */
export function alignBottom(shapes: Shape[]): Map<string, Partial<Shape>> {
  if (shapes.length < 2) return new Map();

  const bounds = shapes.map((s) => ({ shape: s, bounds: getShapeBounds(s) }));
  const bottommostY = Math.max(...bounds.map((b) => b.bounds.bottom));

  const updates = new Map<string, Partial<Shape>>();

  for (const { shape, bounds: shapeBounds } of bounds) {
    const offsetY = bottommostY - shapeBounds.bottom;
    if (offsetY !== 0) {
      updates.set(shape.id, { y: shape.y + offsetY });
    }
  }

  return updates;
}

/**
 * Distribute shapes evenly horizontally (by center points)
 */
export function distributeHorizontally(
  shapes: Shape[],
): Map<string, Partial<Shape>> {
  if (shapes.length < 3) return new Map();

  // Sort shapes by current X position (center)
  const shapesWithBounds = shapes.map((s) => ({
    shape: s,
    bounds: getShapeBounds(s),
  }));
  shapesWithBounds.sort((a, b) => a.bounds.centerX - b.bounds.centerX);

  // Calculate spacing between centers
  const leftmost = shapesWithBounds[0];
  const rightmost = shapesWithBounds[shapesWithBounds.length - 1];
  const totalSpan = rightmost.bounds.centerX - leftmost.bounds.centerX;
  const spacing = totalSpan / (shapes.length - 1);

  const updates = new Map<string, Partial<Shape>>();

  // Update middle shapes (keep first and last in place)
  for (let i = 1; i < shapesWithBounds.length - 1; i++) {
    const { shape, bounds } = shapesWithBounds[i];
    const targetCenterX = leftmost.bounds.centerX + spacing * i;
    const offsetX = targetCenterX - bounds.centerX;
    if (Math.abs(offsetX) > 0.01) {
      updates.set(shape.id, { x: shape.x + offsetX });
    }
  }

  return updates;
}

/**
 * Distribute shapes evenly vertically (by center points)
 */
export function distributeVertically(
  shapes: Shape[],
): Map<string, Partial<Shape>> {
  if (shapes.length < 3) return new Map();

  // Sort shapes by current Y position (center)
  const shapesWithBounds = shapes.map((s) => ({
    shape: s,
    bounds: getShapeBounds(s),
  }));
  shapesWithBounds.sort((a, b) => a.bounds.centerY - b.bounds.centerY);

  // Calculate spacing between centers
  const topmost = shapesWithBounds[0];
  const bottommost = shapesWithBounds[shapesWithBounds.length - 1];
  const totalSpan = bottommost.bounds.centerY - topmost.bounds.centerY;
  const spacing = totalSpan / (shapes.length - 1);

  const updates = new Map<string, Partial<Shape>>();

  // Update middle shapes (keep first and last in place)
  for (let i = 1; i < shapesWithBounds.length - 1; i++) {
    const { shape, bounds } = shapesWithBounds[i];
    const targetCenterY = topmost.bounds.centerY + spacing * i;
    const offsetY = targetCenterY - bounds.centerY;
    if (Math.abs(offsetY) > 0.01) {
      updates.set(shape.id, { y: shape.y + offsetY });
    }
  }

  return updates;
}

/**
 * Get available alignment operations for current selection
 */
export function getAvailableAlignmentOperations(shapes: Shape[]): {
  canAlign: boolean;
  canDistribute: boolean;
} {
  return {
    canAlign: shapes.length >= 2,
    canDistribute: shapes.length >= 3,
  };
}
