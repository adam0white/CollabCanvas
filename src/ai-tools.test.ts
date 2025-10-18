/**
 * AI Tools Test Suite
 *
 * Tests for AI tool implementations:
 * - createShape (rectangle, circle, text)
 * - moveShape
 * - getCanvasState
 * - Color normalization
 * - Tool dispatcher
 */

import { describe, expect, it } from "vitest";
import { Doc } from "yjs";
import {
  createShape,
  dispatchTool,
  getCanvasState,
  moveShape,
  normalizeColor,
} from "./ai-tools";

describe("AI Tools - Color Normalization", () => {
  it("should normalize common color names to hex", () => {
    expect(normalizeColor("red")).toBe("#FF0000");
    expect(normalizeColor("blue")).toBe("#0000FF");
    expect(normalizeColor("green")).toBe("#00FF00");
    expect(normalizeColor("purple")).toBe("#800080");
    expect(normalizeColor("RED")).toBe("#FF0000"); // Case insensitive
  });

  it("should pass through hex colors unchanged", () => {
    expect(normalizeColor("#123456")).toBe("#123456");
    expect(normalizeColor("#FFF")).toBe("#FFF");
  });

  it("should return default color for undefined", () => {
    expect(normalizeColor(undefined)).toBe("#38bdf8");
  });

  it("should pass through unknown color names", () => {
    expect(normalizeColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(normalizeColor("unknown")).toBe("unknown");
  });
});

describe("AI Tools - createShape", () => {
  it("should create a rectangle with valid parameters", () => {
    const doc = new Doc();
    const result = createShape(
      doc,
      {
        type: "rectangle",
        x: 100,
        y: 200,
        width: 150,
        height: 100,
        fill: "red",
      },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.shapeId).toBeDefined();

    const shapesMap = doc.getMap("shapes");
    const shapeId = result.shapeId;
    expect(shapeId).toBeDefined();
    if (!shapeId) throw new Error("shapeId should be defined");
    const shape = shapesMap.get(shapeId);
    expect(shape).toBeDefined();
    expect((shape as { type: string }).type).toBe("rectangle");
    expect((shape as { fill: string }).fill).toBe("#FF0000"); // Color normalized
  });

  it("should create a circle with valid parameters", () => {
    const doc = new Doc();
    const result = createShape(
      doc,
      {
        type: "circle",
        x: 100,
        y: 200,
        radius: 50,
        fill: "blue",
      },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.shapeId).toBeDefined();

    const shapesMap = doc.getMap("shapes");
    const shapeId = result.shapeId;
    expect(shapeId).toBeDefined();
    if (!shapeId) throw new Error("shapeId should be defined");
    const shape = shapesMap.get(shapeId);
    expect(shape).toBeDefined();
    expect((shape as { type: string }).type).toBe("circle");
    expect((shape as { radius: number }).radius).toBe(50);
  });

  it("should create a text shape with valid parameters", () => {
    const doc = new Doc();
    const result = createShape(
      doc,
      {
        type: "text",
        x: 100,
        y: 200,
        text: "Hello World",
        fontSize: 24,
        fill: "black",
      },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.shapeId).toBeDefined();

    const shapesMap = doc.getMap("shapes");
    const shapeId = result.shapeId;
    expect(shapeId).toBeDefined();
    if (!shapeId) throw new Error("shapeId should be defined");
    const shape = shapesMap.get(shapeId);
    expect(shape).toBeDefined();
    expect((shape as { type: string }).type).toBe("text");
    expect((shape as { text: string }).text).toBe("Hello World");
  });

  it("should fail when rectangle missing width/height", () => {
    const doc = new Doc();
    const result = createShape(
      doc,
      {
        type: "rectangle",
        x: 100,
        y: 200,
        fill: "red",
      },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("width");
  });

  it("should fail when circle missing radius", () => {
    const doc = new Doc();
    const result = createShape(
      doc,
      {
        type: "circle",
        x: 100,
        y: 200,
        fill: "blue",
      },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("radius");
  });

  it("should fail when text missing text content", () => {
    const doc = new Doc();
    const result = createShape(
      doc,
      {
        type: "text",
        x: 100,
        y: 200,
        fontSize: 16,
      },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("text");
  });

  it("should mark shapes as AI-generated", () => {
    const doc = new Doc();
    const result = createShape(
      doc,
      {
        type: "rectangle",
        x: 100,
        y: 200,
        width: 150,
        height: 100,
      },
      "test-user",
    );

    const shapesMap = doc.getMap("shapes");
    const shapeId = result.shapeId;
    expect(shapeId).toBeDefined();
    if (!shapeId) throw new Error("shapeId should be defined");
    const shape = shapesMap.get(shapeId);
    // createdBy format is now ai-{userId}
    expect((shape as { createdBy: string }).createdBy).toBe("ai-test-user");
    expect((shape as { aiGenerated: boolean }).aiGenerated).toBe(true);
  });
});

describe("AI Tools - moveShape", () => {
  it("should move an existing shape", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    // Create a shape first
    const shapeId = "test-shape-id";
    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    // Move the shape
    const result = moveShape(doc, { shapeId, x: 200, y: 300 }, "test-user");

    expect(result.success).toBe(true);
    expect(result.shapeId).toBe(shapeId);

    const updated = shapesMap.get(shapeId);
    expect((updated as { x: number }).x).toBe(200);
    expect((updated as { y: number }).y).toBe(300);
  });

  it("should fail when shape not found", () => {
    const doc = new Doc();
    const result = moveShape(
      doc,
      { shapeId: "nonexistent", x: 200, y: 300 },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("AI Tools - getCanvasState", () => {
  it("should return all shapes on canvas", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    // Add multiple shapes
    shapesMap.set("shape1", {
      id: "shape1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    shapesMap.set("shape2", {
      id: "shape2",
      type: "circle",
      x: 100,
      y: 100,
      radius: 25,
    });

    const result = getCanvasState(doc, {}, "test-user");

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as { shapes: unknown[]; count: number };
    expect(data.count).toBe(2);
    expect(data.shapes).toHaveLength(2);
  });

  it("should return empty array when no shapes", () => {
    const doc = new Doc();
    const result = getCanvasState(doc, {}, "test-user");

    expect(result.success).toBe(true);
    const data = result.data as { shapes: unknown[]; count: number };
    expect(data.count).toBe(0);
    expect(data.shapes).toHaveLength(0);
  });
});

describe("AI Tools - dispatchTool", () => {
  it("should dispatch createShape tool", () => {
    const doc = new Doc();
    const result = dispatchTool(
      doc,
      {
        name: "createShape",
        parameters: {
          type: "rectangle",
          x: 100,
          y: 200,
          width: 150,
          height: 100,
        },
      },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.shapeId).toBeDefined();
  });

  it("should dispatch moveShape tool", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    shapesMap.set("test-id", {
      id: "test-id",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });

    const result = dispatchTool(
      doc,
      {
        name: "moveShape",
        parameters: {
          shapeId: "test-id",
          x: 100,
          y: 200,
        },
      },
      "test-user",
    );

    expect(result.success).toBe(true);
  });

  it("should dispatch getCanvasState tool", () => {
    const doc = new Doc();
    const result = dispatchTool(
      doc,
      {
        name: "getCanvasState",
        parameters: {},
      },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("should fail for unknown tool", () => {
    const doc = new Doc();
    const result = dispatchTool(
      doc,
      {
        name: "unknownTool",
        parameters: {},
      },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });
});
