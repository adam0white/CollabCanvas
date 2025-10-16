/**
 * AI Tools Module - Implements foundational AI canvas manipulation tools
 *
 * Architecture:
 * - Tools defined as OpenAI function calling format
 * - Each tool validates parameters and returns result object
 * - Dispatcher routes tool name → implementation
 * - All tools executed within single Yjs transaction (atomic)
 */

import type { Doc } from "yjs";

// ============================================================================
// Tool Schema Definitions (OpenAI Function Calling Format)
// ============================================================================

export const AI_TOOLS = [
  {
    name: "createShape",
    description:
      "Creates a new shape on the canvas at the specified position with styling",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["rectangle", "circle", "text"],
          description: "Type of shape to create",
        },
        x: {
          type: "number",
          description: "X coordinate on canvas",
        },
        y: {
          type: "number",
          description: "Y coordinate on canvas",
        },
        width: {
          type: "number",
          description: "Width for rectangles (required for rectangle)",
        },
        height: {
          type: "number",
          description: "Height for rectangles (required for rectangle)",
        },
        radius: {
          type: "number",
          description: "Radius for circles (required for circle)",
        },
        text: {
          type: "string",
          description: "Text content (required for text shapes)",
        },
        fontSize: {
          type: "number",
          description: "Font size for text shapes (default: 16)",
        },
        fill: {
          type: "string",
          description: 'Fill color as hex (e.g., "#FF0000")',
        },
        stroke: {
          type: "string",
          description: "Stroke color as hex (optional)",
        },
        strokeWidth: {
          type: "number",
          description: "Stroke width in pixels (optional)",
        },
      },
      required: ["type", "x", "y"],
    },
  },
  {
    name: "moveShape",
    description: "Moves a shape to a new position by updating x and y coordinates",
    parameters: {
      type: "object",
      properties: {
        shapeId: {
          type: "string",
          description: "ID of the shape to move",
        },
        x: {
          type: "number",
          description: "New X coordinate",
        },
        y: {
          type: "number",
          description: "New Y coordinate",
        },
      },
      required: ["shapeId", "x", "y"],
    },
  },
  {
    name: "getCanvasState",
    description:
      "Returns all shapes currently on the canvas with their properties",
    parameters: {
      type: "object",
      properties: {},
    },
  },
] as const;

// ============================================================================
// Tool Parameter Types
// ============================================================================

export type CreateShapeParams = {
  type: "rectangle" | "circle" | "text";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type MoveShapeParams = {
  shapeId: string;
  x: number;
  y: number;
};

export type GetCanvasStateParams = Record<string, never>;

// ============================================================================
// Tool Result Types
// ============================================================================

export type ToolResult = {
  success: boolean;
  message: string;
  shapeId?: string;
  shapeIds?: string[];
  data?: unknown;
  error?: string;
};

// ============================================================================
// Color Normalization
// ============================================================================

const COLOR_MAP: Record<string, string> = {
  red: "#FF0000",
  green: "#00FF00",
  blue: "#0000FF",
  yellow: "#FFFF00",
  purple: "#800080",
  orange: "#FFA500",
  pink: "#FFC0CB",
  cyan: "#00FFFF",
  magenta: "#FF00FF",
  lime: "#00FF00",
  teal: "#008080",
  navy: "#000080",
  maroon: "#800000",
  olive: "#808000",
  black: "#000000",
  white: "#FFFFFF",
  gray: "#808080",
  grey: "#808080",
};

export function normalizeColor(color: string | undefined): string {
  if (!color) return "#38bdf8"; // Default blue
  const normalized = color.toLowerCase().trim();
  return COLOR_MAP[normalized] ?? color;
}

// ============================================================================
// Tool Implementations
// ============================================================================

export function createShape(
  doc: Doc,
  params: CreateShapeParams,
  userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const shapeId = crypto.randomUUID();
    const now = Date.now();

    // Validate and normalize parameters
    const fill = normalizeColor(params.fill);
    const stroke = params.stroke ? normalizeColor(params.stroke) : undefined;

    // Build shape data based on type
    let shapeData: Record<string, unknown> = {
      id: shapeId,
      type: params.type,
      x: params.x,
      y: params.y,
      fill,
      stroke,
      strokeWidth: params.strokeWidth,
      createdBy: "ai-assistant",
      createdAt: now,
      aiGenerated: true,
    };

    // Add type-specific properties
    if (params.type === "rectangle") {
      if (!params.width || !params.height) {
        return {
          success: false,
          message: "Rectangle requires width and height",
          error: "Missing required parameters: width, height",
        };
      }
      shapeData = {
        ...shapeData,
        width: params.width,
        height: params.height,
      };
    } else if (params.type === "circle") {
      if (!params.radius) {
        return {
          success: false,
          message: "Circle requires radius",
          error: "Missing required parameter: radius",
        };
      }
      shapeData = {
        ...shapeData,
        radius: params.radius,
      };
    } else if (params.type === "text") {
      if (!params.text) {
        return {
          success: false,
          message: "Text shape requires text content",
          error: "Missing required parameter: text",
        };
      }
      shapeData = {
        ...shapeData,
        text: params.text,
        fontSize: params.fontSize ?? 16,
        fontFamily: "Arial",
        align: "left",
      };
    }

    shapesMap.set(shapeId, shapeData);

    return {
      success: true,
      message: `Created ${params.type} shape`,
      shapeId,
    };
  } catch (error) {
    console.error("[AI Tools] createShape error:", error);
    return {
      success: false,
      message: "Failed to create shape",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function moveShape(
  doc: Doc,
  params: MoveShapeParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const existing = shapesMap.get(params.shapeId);

    if (!existing) {
      return {
        success: false,
        message: `Shape ${params.shapeId} not found`,
        error: "Shape not found",
      };
    }

    // Get current shape data
    const currentData =
      existing instanceof Map
        ? Object.fromEntries(existing.entries())
        : existing;

    // Update position
    const updated = {
      ...currentData,
      x: params.x,
      y: params.y,
    };

    shapesMap.set(params.shapeId, updated);

    return {
      success: true,
      message: `Moved shape to (${params.x}, ${params.y})`,
      shapeId: params.shapeId,
    };
  } catch (error) {
    console.error("[AI Tools] moveShape error:", error);
    return {
      success: false,
      message: "Failed to move shape",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function getCanvasState(
  doc: Doc,
  _params: GetCanvasStateParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const shapes: Record<string, unknown>[] = [];

    for (const [id, value] of shapesMap.entries()) {
      const shapeData =
        value instanceof Map ? Object.fromEntries(value.entries()) : value;
      if (
        typeof shapeData === "object" &&
        shapeData !== null &&
        "type" in shapeData
      ) {
        shapes.push({ id, ...shapeData });
      }
    }

    return {
      success: true,
      message: `Retrieved ${shapes.length} shapes`,
      data: { shapes, count: shapes.length },
    };
  } catch (error) {
    console.error("[AI Tools] getCanvasState error:", error);
    return {
      success: false,
      message: "Failed to get canvas state",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Tool Dispatcher
// ============================================================================

export type ToolCall = {
  name: string;
  parameters: unknown;
};

export function dispatchTool(
  doc: Doc,
  toolCall: ToolCall,
  userId: string,
): ToolResult {
  try {
    switch (toolCall.name) {
      case "createShape":
        return createShape(doc, toolCall.parameters as CreateShapeParams, userId);
      case "moveShape":
        return moveShape(doc, toolCall.parameters as MoveShapeParams, userId);
      case "getCanvasState":
        return getCanvasState(
          doc,
          toolCall.parameters as GetCanvasStateParams,
          userId,
        );
      default:
        return {
          success: false,
          message: `Unknown tool: ${toolCall.name}`,
          error: "Unknown tool",
        };
    }
  } catch (error) {
    console.error(`[AI Tools] Error dispatching tool ${toolCall.name}:`, error);
    return {
      success: false,
      message: `Error executing tool ${toolCall.name}`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
