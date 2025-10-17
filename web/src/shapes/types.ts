/**
 * Shape type definitions for collaborative canvas
 *
 * Design decisions:
 * - Using string IDs (crypto.randomUUID) for uniqueness across clients
 * - All coordinates in canvas pixels
 * - Shapes stored in Y.Map keyed by ID for fast lookups
 * - createdBy tracks ownership (future: permissions, styling)
 * - aiGenerated flag marks AI-created shapes
 */

export type ShapeType = "rectangle" | "circle" | "text";

export type BaseShape = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  rotation?: number; // Rotation in degrees
  createdBy: string;
  createdAt: number;
  aiGenerated?: boolean; // True if created by AI assistant
};

export type Rectangle = BaseShape & {
  type: "rectangle";
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
};

export type Circle = BaseShape & {
  type: "circle";
  radius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
};

export type TextShape = BaseShape & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily?: string;
  align?: "left" | "center" | "right";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  width?: number; // Optional width constraint
};

export type Shape = Rectangle | Circle | TextShape;

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
 * Helper to create a new circle shape
 */
export function createCircle(
  x: number,
  y: number,
  radius: number,
  userId: string,
  fill = "#38bdf8",
): Circle {
  return {
    id: crypto.randomUUID(),
    type: "circle",
    x,
    y,
    radius,
    fill,
    createdBy: userId,
    createdAt: Date.now(),
  };
}

/**
 * Helper to create a new text shape
 */
export function createText(
  x: number,
  y: number,
  text: string,
  userId: string,
  fontSize = 16,
  fill = "#000000",
): TextShape {
  return {
    id: crypto.randomUUID(),
    type: "text",
    x,
    y,
    text,
    fontSize,
    fontFamily: "Arial",
    align: "left",
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

/**
 * Type guard for circles
 */
export function isCircle(shape: Shape): shape is Circle {
  return shape.type === "circle";
}

/**
 * Type guard for text shapes
 */
export function isText(shape: Shape): shape is TextShape {
  return shape.type === "text";
}
