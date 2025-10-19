/**
 * Viewport Culling Utilities
 *
 * Provides functions to determine which shapes are visible in the current viewport.
 * This dramatically improves performance with 500+ shapes by only rendering what's visible.
 *
 * Strategy:
 * - Calculate viewport bounds considering zoom and pan
 * - Add buffer zone around viewport (200px) to prevent pop-in during panning
 * - Test each shape's bounding box against viewport
 * - Support all shape types (rectangle, circle, text)
 */

import type { Circle, Rectangle, Shape } from "../shapes/types";
import { isCircle, isRectangle, isText } from "../shapes/types";

export type ViewportBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/**
 * Calculate viewport bounds in canvas space
 *
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param scale - Current zoom level
 * @param position - Current pan position {x, y}
 * @param buffer - Buffer zone around viewport (default: 200px)
 * @returns Viewport bounds in canvas coordinates
 */
export function calculateViewportBounds(
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  position: { x: number; y: number },
  buffer = 200,
): ViewportBounds {
  // Convert screen space to canvas space with buffer
  return {
    minX: (-position.x - buffer) / scale,
    maxX: (canvasWidth - position.x + buffer) / scale,
    minY: (-position.y - buffer) / scale,
    maxY: (canvasHeight - position.y + buffer) / scale,
  };
}

/**
 * Check if a shape is visible within viewport bounds
 *
 * @param shape - Shape to test
 * @param bounds - Viewport bounds
 * @returns true if shape is (partially) visible
 */
export function isShapeInViewport(
  shape: Shape,
  bounds: ViewportBounds,
): boolean {
  const shapeBounds = getShapeBounds(shape);

  // Simple AABB (Axis-Aligned Bounding Box) intersection test
  return !(
    shapeBounds.maxX < bounds.minX ||
    shapeBounds.minX > bounds.maxX ||
    shapeBounds.maxY < bounds.minY ||
    shapeBounds.minY > bounds.maxY
  );
}

/**
 * Filter shapes to only those visible in viewport
 *
 * @param shapes - All shapes
 * @param bounds - Viewport bounds
 * @returns Array of visible shapes
 */
export function filterVisibleShapes(
  shapes: Shape[],
  bounds: ViewportBounds,
): Shape[] {
  return shapes.filter((shape) => isShapeInViewport(shape, bounds));
}

/**
 * Get bounding box for any shape type
 *
 * @param shape - Shape to get bounds for
 * @returns Bounding box {minX, maxX, minY, maxY}
 */
function getShapeBounds(shape: Shape): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  if (isRectangle(shape)) {
    return getRectangleBounds(shape);
  }

  if (isCircle(shape)) {
    return getCircleBounds(shape);
  }

  if (isText(shape)) {
    return getTextBounds(shape);
  }

  // This should never happen since we check all shape types above
  // TypeScript exhaustiveness check - should be unreachable
  const _exhaustiveCheck: never = shape;
  throw new Error(`Unknown shape type: ${JSON.stringify(_exhaustiveCheck)}`);
}

/**
 * Get bounding box for rectangle
 */
function getRectangleBounds(shape: Rectangle): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  // Handle rotation by expanding bounds to include all possible rotated positions
  // For simplicity, we use the rectangle's dimensions without precise rotation calc
  // This may include slightly more shapes but is fast and prevents culling visible shapes
  const rotation = shape.rotation ?? 0;

  if (rotation === 0) {
    // No rotation - simple case
    return {
      minX: shape.x,
      maxX: shape.x + shape.width,
      minY: shape.y,
      maxY: shape.y + shape.height,
    };
  }

  // With rotation: approximate with a bounding circle centered on the rectangle
  // This creates a tighter bounding box than using top-left corner
  const centerX = shape.x + shape.width / 2;
  const centerY = shape.y + shape.height / 2;
  const halfDiag =
    Math.sqrt(shape.width * shape.width + shape.height * shape.height) / 2;

  return {
    minX: centerX - halfDiag,
    maxX: centerX + halfDiag,
    minY: centerY - halfDiag,
    maxY: centerY + halfDiag,
  };
}

/**
 * Get bounding box for circle
 */
function getCircleBounds(shape: Circle): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return {
    minX: shape.x - shape.radius,
    maxX: shape.x + shape.radius,
    minY: shape.y - shape.radius,
    maxY: shape.y + shape.radius,
  };
}

/**
 * Get bounding box for text
 */
function getTextBounds(shape: Extract<Shape, { type: "text" }>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  // Estimate text width based on character count and font size
  // This is approximate but good enough for culling
  const estimatedWidth =
    shape.width ?? shape.text.length * shape.fontSize * 0.6;
  const estimatedHeight = shape.fontSize * 1.2; // Line height multiplier

  return {
    minX: shape.x,
    maxX: shape.x + estimatedWidth,
    minY: shape.y,
    maxY: shape.y + estimatedHeight,
  };
}

/**
 * Calculate visible shape statistics for debugging
 */
export function getViewportStats(
  totalShapes: number,
  visibleShapes: number,
): {
  totalShapes: number;
  visibleShapes: number;
  culledShapes: number;
  cullPercentage: number;
} {
  const culledShapes = totalShapes - visibleShapes;
  const cullPercentage =
    totalShapes > 0 ? (culledShapes / totalShapes) * 100 : 0;

  return {
    totalShapes,
    visibleShapes,
    culledShapes,
    cullPercentage: Math.round(cullPercentage),
  };
}
