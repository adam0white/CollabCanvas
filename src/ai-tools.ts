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
      "Create one or more shapes (rectangle/circle/text) on the canvas. IMPORTANT: Pass shapes as a JSON array, NOT a string.",
    parameters: {
      type: "object",
      properties: {
        shapes: {
          type: "array",
          description:
            "Array of shape objects to create. MUST be a JSON array, NOT a stringified array. Example: [{type:'circle',x:100,y:200,radius:50}]",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["rectangle", "circle", "text"],
                description: "Shape type: rectangle, circle, or text",
              },
              x: {
                type: "number",
                description: "X coordinate (0-2000)",
              },
              y: {
                type: "number",
                description: "Y coordinate (0-2000)",
              },
              width: {
                type: "number",
                description: "Width in pixels (for rectangle)",
              },
              height: {
                type: "number",
                description: "Height in pixels (for rectangle)",
              },
              radius: {
                type: "number",
                description: "Radius in pixels (for circle)",
              },
              text: {
                type: "string",
                description: "Text content (for text shape)",
              },
              fontSize: {
                type: "number",
                description: "Font size in pixels (for text, default: 16)",
              },
              fill: {
                type: "string",
                description: "Fill color as hex code (e.g., #FF0000 for red)",
              },
            },
            required: ["type", "x", "y"],
          },
        },
      },
      required: ["shapes"],
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

export type ResizeShapeParams = {
  shapeId: string;
  width?: number;
  height?: number;
  radius?: number;
  scale?: number;
};

export type RotateShapeParams = {
  shapeId: string;
  rotation: number;
};

export type UpdateShapeStyleParams = {
  shapeId: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type DeleteShapeParams = {
  shapeId: string;
};

export type ArrangeShapesParams = {
  shapeIds: string[];
  layout: "horizontal" | "vertical" | "grid";
  spacing?: number;
  columns?: number;
};

export type FindShapesParams = {
  type?: "rectangle" | "circle" | "text";
  color?: string;
  contains?: string;
};

export type GetCanvasStateParams = Record<string, never>;

export type CreateMultipleShapesParams = {
  shapes: CreateShapeParams[];
};

export type ComputeCenterParams = {
  viewportCenter?: { x: number; y: number };
};

export type ComputeRelativePositionParams = {
  baseShapeId: string;
  direction: "above" | "below" | "left" | "right";
  offset?: number;
};

export type GetSelectedShapesBoundsParams = {
  shapeIds: string[];
};

export type FindClearSpaceParams = {
  width: number;
  height: number;
};

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
  params: { shapes: CreateShapeParams[] | string } | CreateShapeParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const createdIds: string[] = [];
    const errors: string[] = [];
    const now = Date.now();

    // Normalize to array format
    let shapesArray: CreateShapeParams[];

    if ("shapes" in params) {
      // Handle case where AI returns stringified JSON array instead of actual array
      if (typeof params.shapes === "string") {
        console.warn(
          "[AI Tools] Received stringified shapes, attempting to parse...",
        );
        console.log(
          "[AI Tools] Raw string:",
          (params.shapes as string).substring(0, 150),
        );

        try {
          // Try direct JSON.parse first
          shapesArray = JSON.parse(params.shapes) as CreateShapeParams[];
          console.log(
            "[AI Tools] ✓ Parsed",
            shapesArray.length,
            "shapes from string",
          );
        } catch (_parseError1) {
          console.warn("[AI Tools] Direct parse failed, normalizing quotes...");

          try {
            // Normalize single quotes to double quotes and add quotes to unquoted keys
            const normalized = (params.shapes as string)
              .replace(/'/g, '"')
              .replace(/(\w+):/g, '"$1":');

            shapesArray = JSON.parse(normalized) as CreateShapeParams[];
            console.log(
              "[AI Tools] ✓ Parsed after normalization:",
              shapesArray.length,
              "shapes",
            );
          } catch (parseError2) {
            console.error(
              "[AI Tools] Failed to parse stringified shapes:",
              parseError2,
            );
            console.error("[AI Tools] String that failed:", params.shapes);
            return {
              success: false,
              message:
                "Invalid shapes parameter: expected array but got unparseable string",
              error:
                parseError2 instanceof Error
                  ? parseError2.message
                  : "Parse error",
            };
          }
        }
      } else {
        shapesArray = params.shapes;
      }
    } else {
      shapesArray = [params as CreateShapeParams];
    }

    // Validate that we have an array
    if (!Array.isArray(shapesArray)) {
      console.error("[AI Tools] shapes is not an array:", typeof shapesArray);
      return {
        success: false,
        message: `Invalid shapes parameter: expected array but got ${typeof shapesArray}`,
        error: "Type validation failed",
      };
    }

    for (const shapeSpec of shapesArray) {
      const shapeId = crypto.randomUUID();

      // Validate and normalize colors - MUST be hex format
      const fill = shapeSpec.fill ? normalizeColor(shapeSpec.fill) : "#3B82F6";
      const stroke = shapeSpec.stroke
        ? normalizeColor(shapeSpec.stroke)
        : undefined;

      let shapeData: Record<string, unknown> = {
        id: shapeId,
        type: shapeSpec.type,
        x: shapeSpec.x,
        y: shapeSpec.y,
        fill,
        stroke,
        strokeWidth: shapeSpec.strokeWidth,
        createdBy: "ai-assistant",
        createdAt: now,
        aiGenerated: true,
      };

      // Add type-specific properties
      if (shapeSpec.type === "rectangle") {
        if (!shapeSpec.width || !shapeSpec.height) {
          errors.push(`Rectangle missing width/height`);
          continue;
        }
        shapeData = {
          ...shapeData,
          width: shapeSpec.width,
          height: shapeSpec.height,
        };
      } else if (shapeSpec.type === "circle") {
        if (!shapeSpec.radius) {
          errors.push(`Circle missing radius`);
          continue;
        }
        shapeData = { ...shapeData, radius: shapeSpec.radius };
      } else if (shapeSpec.type === "text") {
        if (!shapeSpec.text) {
          errors.push(`Text shape missing text content`);
          continue;
        }
        shapeData = {
          ...shapeData,
          text: shapeSpec.text,
          fontSize: shapeSpec.fontSize ?? 16,
          fontFamily: "Arial",
          align: "left",
        };
      }

      shapesMap.set(shapeId, shapeData);
      createdIds.push(shapeId);
    }

    if (createdIds.length === 0) {
      return {
        success: false,
        message: "Failed to create shapes",
        error: errors.join("; "),
      };
    }

    return {
      success: true,
      message: `Created ${createdIds.length} shape${createdIds.length > 1 ? "s" : ""}`,
      shapeIds: createdIds,
      shapeId: createdIds[0], // For backward compatibility
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

export function resizeShape(
  doc: Doc,
  params: ResizeShapeParams,
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

    const currentData =
      existing instanceof Map
        ? Object.fromEntries(existing.entries())
        : existing;

    const updated = { ...currentData };

    // Handle scale factor
    if (params.scale !== undefined) {
      if (currentData.width !== undefined) {
        updated.width = currentData.width * params.scale;
      }
      if (currentData.height !== undefined) {
        updated.height = currentData.height * params.scale;
      }
      if (currentData.radius !== undefined) {
        updated.radius = currentData.radius * params.scale;
      }
    } else {
      // Handle absolute dimensions
      if (params.width !== undefined) {
        if (params.width < 10 || params.width > 2000) {
          return {
            success: false,
            message: "Width must be between 10 and 2000 pixels",
            error: "Invalid width",
          };
        }
        updated.width = params.width;
      }
      if (params.height !== undefined) {
        if (params.height < 10 || params.height > 2000) {
          return {
            success: false,
            message: "Height must be between 10 and 2000 pixels",
            error: "Invalid height",
          };
        }
        updated.height = params.height;
      }
      if (params.radius !== undefined) {
        if (params.radius < 5 || params.radius > 1000) {
          return {
            success: false,
            message: "Radius must be between 5 and 1000 pixels",
            error: "Invalid radius",
          };
        }
        updated.radius = params.radius;
      }
    }

    shapesMap.set(params.shapeId, updated);

    return {
      success: true,
      message: "Shape resized successfully",
      shapeId: params.shapeId,
    };
  } catch (error) {
    console.error("[AI Tools] resizeShape error:", error);
    return {
      success: false,
      message: "Failed to resize shape",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function rotateShape(
  doc: Doc,
  params: RotateShapeParams,
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

    const currentData =
      existing instanceof Map
        ? Object.fromEntries(existing.entries())
        : existing;

    // Normalize rotation to 0-360 range
    let rotation = params.rotation % 360;
    if (rotation < 0) {
      rotation += 360;
    }

    const updated = {
      ...currentData,
      rotation,
    };

    shapesMap.set(params.shapeId, updated);

    return {
      success: true,
      message: `Rotated shape to ${rotation}°`,
      shapeId: params.shapeId,
    };
  } catch (error) {
    console.error("[AI Tools] rotateShape error:", error);
    return {
      success: false,
      message: "Failed to rotate shape",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function updateShapeStyle(
  doc: Doc,
  params: UpdateShapeStyleParams,
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

    const currentData =
      existing instanceof Map
        ? Object.fromEntries(existing.entries())
        : existing;

    const updated = { ...currentData };

    if (params.fill !== undefined) {
      updated.fill = normalizeColor(params.fill);
    }
    if (params.stroke !== undefined) {
      updated.stroke = normalizeColor(params.stroke);
    }
    if (params.strokeWidth !== undefined) {
      updated.strokeWidth = params.strokeWidth;
    }

    shapesMap.set(params.shapeId, updated);

    return {
      success: true,
      message: "Shape style updated successfully",
      shapeId: params.shapeId,
    };
  } catch (error) {
    console.error("[AI Tools] updateShapeStyle error:", error);
    return {
      success: false,
      message: "Failed to update shape style",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function deleteShape(
  doc: Doc,
  params: DeleteShapeParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const exists = shapesMap.has(params.shapeId);

    if (!exists) {
      // Idempotent - succeed even if shape doesn't exist
      return {
        success: true,
        message: "Shape already deleted or not found",
        shapeId: params.shapeId,
      };
    }

    shapesMap.delete(params.shapeId);

    return {
      success: true,
      message: "Shape deleted successfully",
      shapeId: params.shapeId,
    };
  } catch (error) {
    console.error("[AI Tools] deleteShape error:", error);
    return {
      success: false,
      message: "Failed to delete shape",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function arrangeShapes(
  doc: Doc,
  params: ArrangeShapesParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const spacing = params.spacing ?? 20;

    // Validate all shapes exist
    const shapes: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const shapeId of params.shapeIds) {
      const shape = shapesMap.get(shapeId);
      if (!shape) {
        return {
          success: false,
          message: `Shape ${shapeId} not found`,
          error: "Shape not found",
        };
      }
      const data =
        shape instanceof Map ? Object.fromEntries(shape.entries()) : shape;
      shapes.push({ id: shapeId, data });
    }

    if (shapes.length === 0) {
      return {
        success: false,
        message: "No shapes to arrange",
        error: "Empty shape list",
      };
    }

    // Use first shape's position as anchor
    const anchor = shapes[0].data;
    const startX = (anchor.x as number) ?? 0;
    const startY = (anchor.y as number) ?? 0;

    // Calculate dimensions for each shape
    const getShapeWidth = (data: Record<string, unknown>): number => {
      if (data.width !== undefined) return data.width as number;
      if (data.radius !== undefined) return (data.radius as number) * 2;
      return 100; // Default for text
    };

    const getShapeHeight = (data: Record<string, unknown>): number => {
      if (data.height !== undefined) return data.height as number;
      if (data.radius !== undefined) return (data.radius as number) * 2;
      return 50; // Default for text
    };

    // Arrange shapes based on layout
    switch (params.layout) {
      case "horizontal": {
        let currentX = startX;
        for (const shape of shapes) {
          const updated = { ...shape.data, x: currentX, y: startY };
          shapesMap.set(shape.id, updated);
          currentX += getShapeWidth(shape.data) + spacing;
        }
        break;
      }
      case "vertical": {
        let currentY = startY;
        for (const shape of shapes) {
          const updated = { ...shape.data, x: startX, y: currentY };
          shapesMap.set(shape.id, updated);
          currentY += getShapeHeight(shape.data) + spacing;
        }
        break;
      }
      case "grid": {
        const columns = params.columns ?? Math.ceil(Math.sqrt(shapes.length));
        let currentX = startX;
        let currentY = startY;
        let maxHeightInRow = 0;

        for (let i = 0; i < shapes.length; i++) {
          const shape = shapes[i];
          const width = getShapeWidth(shape.data);
          const height = getShapeHeight(shape.data);

          const updated = { ...shape.data, x: currentX, y: currentY };
          shapesMap.set(shape.id, updated);

          maxHeightInRow = Math.max(maxHeightInRow, height);
          currentX += width + spacing;

          if ((i + 1) % columns === 0 && i < shapes.length - 1) {
            // Move to next row
            currentX = startX;
            currentY += maxHeightInRow + spacing;
            maxHeightInRow = 0;
          }
        }
        break;
      }
    }

    return {
      success: true,
      message: `Arranged ${shapes.length} shapes in ${params.layout} layout`,
      shapeIds: params.shapeIds,
    };
  } catch (error) {
    console.error("[AI Tools] arrangeShapes error:", error);
    return {
      success: false,
      message: "Failed to arrange shapes",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function findShapes(
  doc: Doc,
  params: FindShapesParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const matches: string[] = [];

    for (const [id, value] of shapesMap.entries()) {
      const shapeData =
        value instanceof Map ? Object.fromEntries(value.entries()) : value;

      if (
        typeof shapeData !== "object" ||
        shapeData === null ||
        !("type" in shapeData)
      ) {
        continue;
      }

      let isMatch = true;

      // Filter by type
      if (params.type !== undefined && shapeData.type !== params.type) {
        isMatch = false;
      }

      // Filter by color
      if (params.color !== undefined && isMatch) {
        const normalizedSearchColor = normalizeColor(params.color);
        const shapeFill =
          "fill" in shapeData
            ? normalizeColor(shapeData.fill as string)
            : undefined;
        if (shapeFill !== normalizedSearchColor) {
          isMatch = false;
        }
      }

      // Filter by text content
      if (params.contains !== undefined && isMatch) {
        if ("text" in shapeData && typeof shapeData.text === "string") {
          if (
            !shapeData.text
              .toLowerCase()
              .includes(params.contains.toLowerCase())
          ) {
            isMatch = false;
          }
        } else {
          isMatch = false;
        }
      }

      if (isMatch) {
        matches.push(id);
      }
    }

    return {
      success: true,
      message: `Found ${matches.length} matching shapes`,
      shapeIds: matches,
      data: { matches },
    };
  } catch (error) {
    console.error("[AI Tools] findShapes error:", error);
    return {
      success: false,
      message: "Failed to find shapes",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function createMultipleShapes(
  doc: Doc,
  params: CreateMultipleShapesParams,
  userId: string,
): ToolResult {
  try {
    if (!params.shapes || params.shapes.length === 0) {
      return {
        success: false,
        message: "No shapes to create",
        error: "Empty shapes array",
      };
    }

    const createdIds: string[] = [];
    const errors: string[] = [];

    // Create all shapes (already within transaction from caller)
    for (const shapeSpec of params.shapes) {
      const result = createShape(doc, shapeSpec, userId);
      if (result.success && result.shapeId) {
        createdIds.push(result.shapeId);
      } else {
        errors.push(result.message);
      }
    }

    if (createdIds.length === 0) {
      return {
        success: false,
        message: "Failed to create any shapes",
        error: errors.join("; "),
      };
    }

    return {
      success: true,
      message: `Created ${createdIds.length} shapes`,
      shapeIds: createdIds,
      data: { createdIds, errors: errors.length > 0 ? errors : undefined },
    };
  } catch (error) {
    console.error("[AI Tools] createMultipleShapes error:", error);
    return {
      success: false,
      message: "Failed to create multiple shapes",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function computeCenter(
  _doc: Doc,
  params: ComputeCenterParams,
  _userId: string,
): ToolResult {
  try {
    // Use viewport center if provided, otherwise use canvas center
    const center = params.viewportCenter ?? { x: 1000, y: 1000 }; // Default canvas center (2000x2000 / 2)

    return {
      success: true,
      message: `Center computed at (${center.x}, ${center.y})`,
      data: { center },
    };
  } catch (error) {
    console.error("[AI Tools] computeCenter error:", error);
    return {
      success: false,
      message: "Failed to compute center",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function computeRelativePosition(
  doc: Doc,
  params: ComputeRelativePositionParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");
    const baseShape = shapesMap.get(params.baseShapeId);

    if (!baseShape) {
      return {
        success: false,
        message: `Base shape ${params.baseShapeId} not found`,
        error: "Shape not found",
      };
    }

    const baseData =
      baseShape instanceof Map
        ? Object.fromEntries(baseShape.entries())
        : baseShape;

    const baseX = (baseData.x as number) ?? 0;
    const baseY = (baseData.y as number) ?? 0;
    const offset = params.offset ?? 20;

    // Calculate base shape dimensions
    let width = 100;
    let height = 100;
    if (baseData.width !== undefined) width = baseData.width as number;
    if (baseData.height !== undefined) height = baseData.height as number;
    if (baseData.radius !== undefined) {
      width = height = (baseData.radius as number) * 2;
    }

    let x = baseX;
    let y = baseY;

    switch (params.direction) {
      case "above":
        y = baseY - offset - height;
        break;
      case "below":
        y = baseY + height + offset;
        break;
      case "left":
        x = baseX - offset - width;
        break;
      case "right":
        x = baseX + width + offset;
        break;
    }

    return {
      success: true,
      message: `Computed position ${params.direction} of base shape`,
      data: { position: { x, y } },
    };
  } catch (error) {
    console.error("[AI Tools] computeRelativePosition error:", error);
    return {
      success: false,
      message: "Failed to compute relative position",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function getSelectedShapesBounds(
  doc: Doc,
  params: GetSelectedShapesBoundsParams,
  _userId: string,
): ToolResult {
  try {
    const shapesMap = doc.getMap("shapes");

    if (params.shapeIds.length === 0) {
      return {
        success: false,
        message: "No shapes provided",
        error: "Empty shape IDs array",
      };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const shapeId of params.shapeIds) {
      const shape = shapesMap.get(shapeId);
      if (!shape) continue;

      const data =
        shape instanceof Map ? Object.fromEntries(shape.entries()) : shape;

      const x = (data.x as number) ?? 0;
      const y = (data.y as number) ?? 0;
      let width = 0;
      let height = 0;

      if (data.width !== undefined) width = data.width as number;
      if (data.height !== undefined) height = data.height as number;
      if (data.radius !== undefined) {
        width = height = (data.radius as number) * 2;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }

    if (
      minX === Number.POSITIVE_INFINITY ||
      minY === Number.POSITIVE_INFINITY
    ) {
      return {
        success: false,
        message: "No valid shapes found",
        error: "No shapes to compute bounds for",
      };
    }

    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };

    return {
      success: true,
      message: "Computed bounding box for selected shapes",
      data: { bounds },
    };
  } catch (error) {
    console.error("[AI Tools] getSelectedShapesBounds error:", error);
    return {
      success: false,
      message: "Failed to compute bounds",
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
  parameters: Record<string, unknown>;
};

export function dispatchTool(
  doc: Doc,
  toolCall: ToolCall,
  userId: string,
): ToolResult {
  try {
    switch (toolCall.name) {
      case "createShape": {
        // Ensure params are in array format
        const params = toolCall.parameters as
          | { shapes: CreateShapeParams[] }
          | CreateShapeParams;
        const shapesArray = "shapes" in params ? params : { shapes: [params] };
        return createShape(doc, shapesArray, userId);
      }
      case "moveShape":
        return moveShape(doc, toolCall.parameters as MoveShapeParams, userId);
      case "resizeShape":
        return resizeShape(
          doc,
          toolCall.parameters as ResizeShapeParams,
          userId,
        );
      case "rotateShape":
        return rotateShape(
          doc,
          toolCall.parameters as RotateShapeParams,
          userId,
        );
      case "updateShapeStyle":
        return updateShapeStyle(
          doc,
          toolCall.parameters as UpdateShapeStyleParams,
          userId,
        );
      case "deleteShape":
        return deleteShape(
          doc,
          toolCall.parameters as DeleteShapeParams,
          userId,
        );
      case "arrangeShapes":
        return arrangeShapes(
          doc,
          toolCall.parameters as ArrangeShapesParams,
          userId,
        );
      case "findShapes":
        return findShapes(doc, toolCall.parameters as FindShapesParams, userId);
      case "createMultipleShapes":
        // Redirect to createShape with array format (unified API)
        return createShape(
          doc,
          {
            shapes: (toolCall.parameters as CreateMultipleShapesParams).shapes,
          },
          userId,
        );
      case "computeCenter":
        return computeCenter(
          doc,
          toolCall.parameters as ComputeCenterParams,
          userId,
        );
      case "computeRelativePosition":
        return computeRelativePosition(
          doc,
          toolCall.parameters as ComputeRelativePositionParams,
          userId,
        );
      case "getSelectedShapesBounds":
        return getSelectedShapesBounds(
          doc,
          toolCall.parameters as GetSelectedShapesBoundsParams,
          userId,
        );
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
