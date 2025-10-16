/**
 * AI Tools module
 *
 * Defines tool schema and dispatcher used by the AI Canvas Agent.
 * All tool executions are designed to run within a single Yjs transaction
 * coordinated by the Durable Object. Tools must be pure with respect to inputs
 * and outputs, with validation and clear error messages.
 */

import type { Doc, Map as YMap } from "yjs";

export type ToolCall = {
  name: ToolName;
  arguments: Record<string, unknown>;
};

export type ToolName =
  | "createShape"
  | "moveShape"
  | "getCanvasState"
  | "resizeShape"
  | "rotateShape"
  | "updateShapeStyle"
  | "deleteShape"
  | "arrangeShapes"
  | "findShapes"
  | "createMultipleShapes";

export type ToolResult = {
  name: ToolName;
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type ExecuteContext = {
  doc: Doc;
  userId: string;
  userName: string;
  now: number;
};

export type CanvasShape = {
  id: string;
  type: "rectangle"; // Phase 1: rectangle only (circle/text arrive in PR14)
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  createdBy: string;
  createdAt: number;
};

export type ToolSchema = Array<{
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
}>;

export const TOOL_SCHEMA: ToolSchema = [
  {
    name: "createShape",
    description: "Creates a new shape on the canvas",
    parameters: {
      type: "object",
      properties: {
        type: { enum: ["rectangle", "circle", "text"] },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        radius: { type: "number" },
        text: { type: "string" },
        fill: { type: "string", description: "Hex color" },
      },
      required: ["type", "x", "y"],
    },
  },
  {
    name: "moveShape",
    description: "Moves an existing shape by ID to a position",
    parameters: {
      type: "object",
      properties: {
        shapeId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["shapeId", "x", "y"],
    },
  },
  {
    name: "getCanvasState",
    description: "Returns current canvas shapes and properties",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "resizeShape",
    description: "Resizes a shape by absolute size or scale",
    parameters: {
      type: "object",
      properties: {
        shapeId: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        radius: { type: "number" },
        scale: { type: "number" },
      },
      required: ["shapeId"],
    },
  },
  {
    name: "rotateShape",
    description: "Sets shape rotation in degrees (0-360)",
    parameters: {
      type: "object",
      properties: {
        shapeId: { type: "string" },
        rotation: { type: "number" },
      },
      required: ["shapeId", "rotation"],
    },
  },
  {
    name: "updateShapeStyle",
    description: "Updates fill/stroke colors and strokeWidth",
    parameters: {
      type: "object",
      properties: {
        shapeId: { type: "string" },
        fill: { type: "string" },
        stroke: { type: "string" },
        strokeWidth: { type: "number" },
      },
      required: ["shapeId"],
    },
  },
  {
    name: "deleteShape",
    description: "Deletes a shape by ID (idempotent)",
    parameters: {
      type: "object",
      properties: { shapeId: { type: "string" } },
      required: ["shapeId"],
    },
  },
  {
    name: "arrangeShapes",
    description: "Arranges shapes in horizontal/vertical/grid layout",
    parameters: {
      type: "object",
      properties: {
        shapeIds: { type: "array", items: { type: "string" } },
        layout: { enum: ["horizontal", "vertical", "grid"] },
        spacing: { type: "number" },
        columns: { type: "number" },
      },
      required: ["shapeIds", "layout"],
    },
  },
  {
    name: "findShapes",
    description: "Finds shapes by criteria (type, color, contains)",
    parameters: {
      type: "object",
      properties: {
        criteria: {
          type: "object",
          properties: {
            type: { enum: ["rectangle", "circle", "text"] },
            color: { type: "string" },
            contains: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "createMultipleShapes",
    description: "Creates multiple shapes in one call",
    parameters: {
      type: "object",
      properties: {
        shapes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { enum: ["rectangle", "circle", "text"] },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              radius: { type: "number" },
              text: { type: "string" },
              fill: { type: "string" },
            },
            required: ["type", "x", "y"],
          },
        },
      },
      required: ["shapes"],
    },
  },
];

// Minimal color normalization map for Phase 1
const COLOR_MAP: Record<string, string> = {
  red: "#FF0000",
  blue: "#0000FF",
  green: "#00FF00",
  purple: "#800080",
  black: "#000000",
  white: "#FFFFFF",
  gray: "#808080",
  grey: "#808080",
};

export function normalizeColor(input: unknown): string | null {
  if (typeof input !== "string" || input.length < 1) return null;
  const trimmed = input.trim().toLowerCase();
  if (COLOR_MAP[trimmed]) return COLOR_MAP[trimmed];
  // Accept already-hex colors (#RGB, #RRGGBB)
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed.toUpperCase();
  // Accept simple rgb(...) strings untouched for now
  if (/^rgb\(/i.test(trimmed)) return input;
  return null;
}

export function getShapesMap(doc: Doc): YMap<unknown> {
  return doc.getMap<unknown>("shapes");
}

export function getAllShapes(doc: Doc): CanvasShape[] {
  const shapesMap = getShapesMap(doc);
  const shapes: CanvasShape[] = [];
  for (const [, value] of shapesMap.entries()) {
    const shape = value instanceof Map ? Object.fromEntries(value.entries()) : value;
    const s = shape as Partial<CanvasShape> & Record<string, unknown>;
    if (s && typeof s === "object" && typeof s.id === "string" && typeof s.type === "string") {
      shapes.push(s as CanvasShape);
    }
  }
  return shapes;
}

export function dispatchTool(
  ctx: ExecuteContext,
  call: ToolCall,
): ToolResult {
  try {
    switch (call.name) {
      case "createShape":
        return createShapeTool(ctx, call.arguments);
      case "moveShape":
        return moveShapeTool(ctx, call.arguments);
      case "getCanvasState":
        return getCanvasStateTool(ctx);
      case "resizeShape":
        return resizeShapeTool(ctx, call.arguments);
      case "rotateShape":
        return rotateShapeTool(ctx, call.arguments);
      case "updateShapeStyle":
        return updateShapeStyleTool(ctx, call.arguments);
      case "deleteShape":
        return deleteShapeTool(ctx, call.arguments);
      case "arrangeShapes":
        return arrangeShapesTool(ctx, call.arguments);
      case "findShapes":
        return findShapesTool(ctx, call.arguments);
      case "createMultipleShapes":
        return createMultipleShapesTool(ctx, call.arguments);
      default:
        return {
          name: call.name as ToolName,
          ok: false,
          error: `Unknown tool: ${String(call.name)}`,
        } as ToolResult;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = (call as { name?: ToolName })?.name;
    return { name: name ?? "getCanvasState", ok: false, error: message };
  }
}

function createShapeTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const type = String(args.type ?? "");
  const x = numberOrThrow(args.x, "x");
  const y = numberOrThrow(args.y, "y");

  if (type !== "rectangle") {
    return {
      name: "createShape",
      ok: false,
      error:
        "Unsupported shape type for Phase 1. Only 'rectangle' is implemented.",
    };
  }

  const width = clamp(numberOrDefault(args.width, 120), 10, 2000);
  const height = clamp(numberOrDefault(args.height, 80), 10, 2000);
  const fillInput = typeof args.fill === "string" ? args.fill : "#38BDF8";
  const fill = normalizeColor(fillInput) ?? "#38BDF8";

  const shape: CanvasShape = {
    id: crypto.randomUUID(),
    type: "rectangle",
    x,
    y,
    width,
    height,
    fill,
    createdBy: "ai-assistant",
    createdAt: ctx.now,
  };

  const shapesMap = getShapesMap(ctx.doc);
  // Store as plain object (JSON-compatible)
  shapesMap.set(shape.id, shape);

  return {
    name: "createShape",
    ok: true,
    data: { id: shape.id },
  };
}

function moveShapeTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const shapeId = String(args.shapeId ?? "");
  if (!shapeId) throw new Error("shapeId is required");
  const x = numberOrThrow(args.x, "x");
  const y = numberOrThrow(args.y, "y");

  const shapesMap = getShapesMap(ctx.doc);
  const existing = shapesMap.get(shapeId);
  if (!existing) {
    return { name: "moveShape", ok: false, error: `Shape not found: ${shapeId}` };
  }
  const current = existing instanceof Map ? Object.fromEntries(existing.entries()) : existing;
  const updated = { ...current, x, y };
  shapesMap.set(shapeId, updated);
  return { name: "moveShape", ok: true, data: { id: shapeId, x, y } };
}

function getCanvasStateTool(ctx: ExecuteContext): ToolResult {
  const shapes = getAllShapes(ctx.doc);
  return { name: "getCanvasState", ok: true, data: { shapes } };
}

function resizeShapeTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const shapeId = String(args.shapeId ?? "");
  if (!shapeId) throw new Error("shapeId is required");
  const shapesMap = getShapesMap(ctx.doc);
  const existing = shapesMap.get(shapeId);
  if (!existing) {
    return { name: "resizeShape", ok: false, error: `Shape not found: ${shapeId}` };
  }
  const current = existing instanceof Map ? Object.fromEntries(existing.entries()) : (existing as unknown);
  const cur = current as Partial<CanvasShape>;
  const scale = numberOrDefault(args.scale, NaN);
  let width = numberOrDefault(args.width, (cur.width as number | undefined) ?? NaN);
  let height = numberOrDefault(args.height, (cur.height as number | undefined) ?? NaN);
  if (Number.isFinite(scale)) {
    if (Number.isFinite(width)) width *= scale;
    if (Number.isFinite(height)) height *= scale;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { name: "resizeShape", ok: false, error: "Missing width/height for rectangle" };
  }
  width = clamp(width, 10, 2000);
  height = clamp(height, 10, 2000);
  const updated = { ...current, width, height };
  shapesMap.set(shapeId, updated);
  return { name: "resizeShape", ok: true, data: { id: shapeId, width, height } };
}

function rotateShapeTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const shapeId = String(args.shapeId ?? "");
  if (!shapeId) throw new Error("shapeId is required");
  const rotationRaw = numberOrThrow(args.rotation, "rotation");
  let rotation = Math.round(rotationRaw) % 360;
  if (rotation < 0) rotation += 360;
  const shapesMap = getShapesMap(ctx.doc);
  const existing = shapesMap.get(shapeId);
  if (!existing) {
    return { name: "rotateShape", ok: false, error: `Shape not found: ${shapeId}` };
  }
  const current = existing instanceof Map ? Object.fromEntries(existing.entries()) : (existing as unknown);
  const updated = { ...(current as Record<string, unknown>), rotation };
  shapesMap.set(shapeId, updated);
  return { name: "rotateShape", ok: true, data: { id: shapeId, rotation } };
}

function updateShapeStyleTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const shapeId = String(args.shapeId ?? "");
  if (!shapeId) throw new Error("shapeId is required");
  const shapesMap = getShapesMap(ctx.doc);
  const existing = shapesMap.get(shapeId);
  if (!existing) {
    return { name: "updateShapeStyle", ok: false, error: `Shape not found: ${shapeId}` };
  }
  const current = existing instanceof Map ? Object.fromEntries(existing.entries()) : (existing as unknown);
  const updates: Record<string, unknown> = {};
  if (typeof args.fill === "string") {
    const norm = normalizeColor(args.fill);
    if (!norm) return { name: "updateShapeStyle", ok: false, error: "Invalid fill color" };
    updates.fill = norm;
  }
  if (typeof args.stroke === "string") {
    const norm = normalizeColor(args.stroke);
    if (!norm) return { name: "updateShapeStyle", ok: false, error: "Invalid stroke color" };
    updates.stroke = norm;
  }
  if (typeof args.strokeWidth !== "undefined") {
    const sw = numberOrThrow(args.strokeWidth, "strokeWidth");
    updates.strokeWidth = clamp(sw, 0, 50);
  }
  const updated = { ...current, ...updates };
  shapesMap.set(shapeId, updated);
  return { name: "updateShapeStyle", ok: true, data: { id: shapeId } };
}

function deleteShapeTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const shapeId = String(args.shapeId ?? "");
  if (!shapeId) throw new Error("shapeId is required");
  const shapesMap = getShapesMap(ctx.doc);
  shapesMap.delete(shapeId);
  return { name: "deleteShape", ok: true, data: { id: shapeId } };
}

type Layout = "horizontal" | "vertical" | "grid";

function arrangeShapesTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const ids = Array.isArray((args as { shapeIds?: unknown[] }).shapeIds)
    ? ((args as { shapeIds?: unknown[] }).shapeIds as unknown[])
    : [];
  const shapeIds = ids.map(String);
  const layout = String((args as { layout?: string }).layout ?? "horizontal") as Layout;
  const spacing = clamp(numberOrDefault((args as { spacing?: number }).spacing, 20), 0, 1000);
  const columns = Math.max(
    1,
    Math.floor(numberOrDefault((args as { columns?: number }).columns, 1)),
  );

  if (!shapeIds.length) {
    return { name: "arrangeShapes", ok: false, error: "No shapeIds provided" };
  }

  const shapesMap = getShapesMap(ctx.doc);
  const shapes = shapeIds
    .map((id) => [id, shapesMap.get(id)] as const)
    .filter(([, s]) => !!s)
    .map(([id, s]) => [id, s instanceof Map ? Object.fromEntries(s.entries()) : s] as const);

  if (!shapes.length) {
    return { name: "arrangeShapes", ok: false, error: "No matching shapes found" };
  }

  const first = shapes[0][1] as Partial<CanvasShape> & Record<string, unknown>;
  const origin = {
    x: (first.x as number | undefined) ?? 0,
    y: (first.y as number | undefined) ?? 0,
  };

  if (layout === "horizontal") {
    let cursorX = origin.x;
    for (const [id, s] of shapes) {
      const shape = s as Partial<CanvasShape> & Record<string, unknown>;
      const w = (shape.width as number | undefined) ?? 0;
      shapesMap.set(id, { ...shape, x: cursorX, y: origin.y });
      cursorX += (w || 0) + spacing;
    }
  } else if (layout === "vertical") {
    let cursorY = origin.y;
    for (const [id, s] of shapes) {
      const shape = s as Partial<CanvasShape> & Record<string, unknown>;
      const h = (shape.height as number | undefined) ?? 0;
      shapesMap.set(id, { ...shape, x: origin.x, y: cursorY });
      cursorY += (h || 0) + spacing;
    }
  } else if (layout === "grid") {
    for (let i = 0; i < shapes.length; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const [id, s] = shapes[i];
      const shape = s as Partial<CanvasShape> & Record<string, unknown>;
      const w = (shape.width as number | undefined) ?? 0;
      const h = (shape.height as number | undefined) ?? 0;
      const x = origin.x + col * (w + spacing);
      const y = origin.y + row * (h + spacing);
      shapesMap.set(id, { ...shape, x, y });
    }
  }

  return { name: "arrangeShapes", ok: true, data: { count: shapes.length } };
}

function findShapesTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const criteria = (args as { criteria?: Record<string, unknown> })?.criteria ?? {};
  const type = typeof criteria.type === "string" ? criteria.type : undefined;
  const colorRaw = typeof criteria.color === "string" ? criteria.color : undefined;
  const color = colorRaw ? normalizeColor(colorRaw) ?? colorRaw : undefined;
  const contains = typeof criteria.contains === "string" ? criteria.contains.toLowerCase() : undefined;
  const shapes = getAllShapes(ctx.doc);
  const matches: string[] = [];
  for (const shape of shapes) {
    if (type && shape.type !== type) continue;
    if (color && !(shape.fill?.toLowerCase?.() === color.toLowerCase())) continue;
    if (contains && typeof (shape as unknown as { text?: string }).text === "string") {
      const textValue = (shape as unknown as { text?: string }).text as string;
      if (!textValue.toLowerCase().includes(contains)) continue;
    } else if (contains) {
      continue;
    }
    matches.push(shape.id);
  }
  return { name: "findShapes", ok: true, data: { shapeIds: matches } };
}

function createMultipleShapesTool(
  ctx: ExecuteContext,
  args: Record<string, unknown>,
): ToolResult {
  const specs = Array.isArray((args as { shapes?: unknown[] })?.shapes)
    ? ((args as { shapes?: unknown[] }).shapes as unknown[])
    : [];
  if (!specs.length) return { name: "createMultipleShapes", ok: false, error: "No shapes provided" };
  const shapesMap = getShapesMap(ctx.doc);
  const ids: string[] = [];
  for (const spec of specs) {
    const specObj = spec as Record<string, unknown>;
    const type = String(specObj.type ?? "");
    if (type !== "rectangle") {
      return {
        name: "createMultipleShapes",
        ok: false,
        error: "Unsupported shape type in batch: only rectangle in Phase 1",
      };
    }
    const x = numberOrThrow(specObj.x, "x");
    const y = numberOrThrow(specObj.y, "y");
    const width = clamp(numberOrDefault(specObj.width, 120), 10, 2000);
    const height = clamp(numberOrDefault(specObj.height, 80), 10, 2000);
    const fillInput = typeof specObj.fill === "string" ? (specObj.fill as string) : "#38BDF8";
    const fill = normalizeColor(fillInput) ?? "#38BDF8";
    const shape: CanvasShape = {
      id: crypto.randomUUID(),
      type: "rectangle",
      x,
      y,
      width,
      height,
      fill,
      createdBy: "ai-assistant",
      createdAt: ctx.now,
    };
    shapesMap.set(shape.id, shape);
    ids.push(shape.id);
    if (ids.length > 50) {
      return {
        name: "createMultipleShapes",
        ok: false,
        error: "Too many shapes requested in batch (max 50)",
      };
    }
  }
  return { name: "createMultipleShapes", ok: true, data: { ids } };
}

function numberOrThrow(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${field}`);
  return n;
}

function numberOrDefault(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
