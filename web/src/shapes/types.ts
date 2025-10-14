/**
 * Shape type definitions for collaborative canvas
 *
 * Design decisions:
 * - Using string IDs (crypto.randomUUID) for uniqueness across clients
 * - All coordinates in canvas pixels
 * - Shapes stored in Y.Map keyed by ID for fast lookups
 * - createdBy tracks ownership (future: permissions, styling)
 */

export type ShapeType = "rectangle";

export type BaseShape = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  createdBy: string;
  createdAt: number;
};

export type Rectangle = BaseShape & {
  type: "rectangle";
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
};

export type Shape = Rectangle;

/**
 * Helper to create a new rectangle shape
 */
export function createRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  userId: string,
  fill = "#38bdf8",
): Rectangle {
  return {
    id: crypto.randomUUID(),
    type: "rectangle",
    x,
    y,
    width,
    height,
    fill,
    createdBy: userId,
    createdAt: Date.now(),
  };
}

/**
 * Type guard for rectangles
 */
export function isRectangle(shape: Shape): shape is Rectangle {
  return shape.type === "rectangle";
}
