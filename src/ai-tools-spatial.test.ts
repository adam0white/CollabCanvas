/**
 * AI Tools Spatial Test Suite
 *
 * Tests for PR13 spatial and batch creation tools:
 * - createMultipleShapes
 * - computeCenter
 * - computeRelativePosition
 * - getSelectedShapesBounds
 */

import { describe, expect, it } from "vitest";
import { Doc } from "yjs";
import {
  computeCenter,
  computeRelativePosition,
  createMultipleShapes,
  getSelectedShapesBounds,
} from "./ai-tools";

describe("AI Tools - createMultipleShapes", () => {
  it("should create multiple shapes in one call", () => {
    const doc = new Doc();
    const result = createMultipleShapes(
      doc,
      {
        shapes: [
          {
            type: "rectangle",
            x: 100,
            y: 100,
            width: 50,
            height: 50,
            fill: "red",
          },
          {
            type: "circle",
            x: 200,
            y: 100,
            radius: 25,
            fill: "blue",
          },
          {
            type: "text",
            x: 300,
            y: 100,
            text: "Hello",
            fontSize: 16,
            fill: "black",
          },
        ],
      },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.shapeIds).toHaveLength(3);

    const shapesMap = doc.getMap("shapes");
    expect(shapesMap.size).toBe(3);
  });

  it("should fail with empty shapes array", () => {
    const doc = new Doc();
    const result = createMultipleShapes(
      doc,
      { shapes: [] },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Empty");
  });

  it("should handle partial failures gracefully", () => {
    const doc = new Doc();
    const result = createMultipleShapes(
      doc,
      {
        shapes: [
          {
            type: "rectangle",
            x: 100,
            y: 100,
            width: 50,
            height: 50,
          },
          {
            type: "rectangle",
            x: 200,
            y: 100,
            // Missing width/height - will fail
          },
          {
            type: "circle",
            x: 300,
            y: 100,
            radius: 25,
          },
        ],
      },
      "test-user",
    );

    // Should succeed for the valid shapes
    expect(result.success).toBe(true);
    expect(result.shapeIds?.length).toBeGreaterThan(0);
  });

  it("should create login form with multiple shapes", () => {
    const doc = new Doc();
    const result = createMultipleShapes(
      doc,
      {
        shapes: [
          {
            type: "text",
            x: 200,
            y: 200,
            text: "Username",
            fontSize: 16,
          },
          {
            type: "rectangle",
            x: 200,
            y: 230,
            width: 200,
            height: 40,
            fill: "white",
          },
          {
            type: "text",
            x: 200,
            y: 280,
            text: "Password",
            fontSize: 16,
          },
          {
            type: "rectangle",
            x: 200,
            y: 310,
            width: 200,
            height: 40,
            fill: "white",
          },
          {
            type: "rectangle",
            x: 200,
            y: 370,
            width: 200,
            height: 40,
            fill: "blue",
          },
        ],
      },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.shapeIds).toHaveLength(5);
  });
});

describe("AI Tools - computeCenter", () => {
  it("should return default canvas center when no viewport provided", () => {
    const doc = new Doc();
    const result = computeCenter(doc, {}, "test-user");

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as { center: { x: number; y: number } };
    expect(data.center.x).toBe(1000);
    expect(data.center.y).toBe(1000);
  });

  it("should use provided viewport center", () => {
    const doc = new Doc();
    const result = computeCenter(
      doc,
      { viewportCenter: { x: 500, y: 600 } },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as { center: { x: number; y: number } };
    expect(data.center.x).toBe(500);
    expect(data.center.y).toBe(600);
  });
});

describe("AI Tools - computeRelativePosition", () => {
  it("should compute position above base shape", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const baseId = "base-shape";

    shapesMap.set(baseId, {
      id: baseId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = computeRelativePosition(
      doc,
      { baseShapeId: baseId, direction: "above", offset: 20 },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as { position: { x: number; y: number } };
    expect(data.position.x).toBe(100);
    expect(data.position.y).toBe(30); // 100 - 20 - 50
  });

  it("should compute position below base shape", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const baseId = "base-shape";

    shapesMap.set(baseId, {
      id: baseId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = computeRelativePosition(
      doc,
      { baseShapeId: baseId, direction: "below", offset: 20 },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as { position: { x: number; y: number } };
    expect(data.position.x).toBe(100);
    expect(data.position.y).toBe(170); // 100 + 50 + 20
  });

  it("should compute position left of base shape", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const baseId = "base-shape";

    shapesMap.set(baseId, {
      id: baseId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = computeRelativePosition(
      doc,
      { baseShapeId: baseId, direction: "left", offset: 20 },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as { position: { x: number; y: number } };
    expect(data.position.x).toBe(30); // 100 - 20 - 50
    expect(data.position.y).toBe(100);
  });

  it("should compute position right of base shape", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const baseId = "base-shape";

    shapesMap.set(baseId, {
      id: baseId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = computeRelativePosition(
      doc,
      { baseShapeId: baseId, direction: "right", offset: 20 },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as { position: { x: number; y: number } };
    expect(data.position.x).toBe(170); // 100 + 50 + 20
    expect(data.position.y).toBe(100);
  });

  it("should handle circles correctly", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const baseId = "circle-shape";

    shapesMap.set(baseId, {
      id: baseId,
      type: "circle",
      x: 100,
      y: 100,
      radius: 25,
    });

    const result = computeRelativePosition(
      doc,
      { baseShapeId: baseId, direction: "right", offset: 10 },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as { position: { x: number; y: number } };
    expect(data.position.x).toBe(160); // 100 + (25*2) + 10
  });

  it("should fail if base shape not found", () => {
    const doc = new Doc();
    const result = computeRelativePosition(
      doc,
      { baseShapeId: "nonexistent", direction: "below" },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("AI Tools - getSelectedShapesBounds", () => {
  it("should compute bounding box for multiple shapes", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    shapesMap.set("shape1", {
      id: "shape1",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    shapesMap.set("shape2", {
      id: "shape2",
      type: "rectangle",
      x: 200,
      y: 150,
      width: 50,
      height: 50,
    });

    const result = getSelectedShapesBounds(
      doc,
      { shapeIds: ["shape1", "shape2"] },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as {
      bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
        centerX: number;
        centerY: number;
      };
    };
    expect(data.bounds.x).toBe(100);
    expect(data.bounds.y).toBe(100);
    expect(data.bounds.width).toBe(150); // 200 + 50 - 100
    expect(data.bounds.height).toBe(100); // 150 + 50 - 100
    expect(data.bounds.centerX).toBe(175); // (100 + 250) / 2
    expect(data.bounds.centerY).toBe(150); // (100 + 200) / 2
  });

  it("should handle circles in bounds calculation", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    shapesMap.set("circle1", {
      id: "circle1",
      type: "circle",
      x: 100,
      y: 100,
      radius: 25,
    });

    const result = getSelectedShapesBounds(
      doc,
      { shapeIds: ["circle1"] },
      "test-user",
    );

    expect(result.success).toBe(true);
    const data = result.data as { bounds: { width: number; height: number } };
    expect(data.bounds.width).toBe(50); // radius * 2
    expect(data.bounds.height).toBe(50);
  });

  it("should fail with empty shape IDs", () => {
    const doc = new Doc();
    const result = getSelectedShapesBounds(
      doc,
      { shapeIds: [] },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Empty");
  });

  it("should handle missing shapes gracefully", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    shapesMap.set("shape1", {
      id: "shape1",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = getSelectedShapesBounds(
      doc,
      { shapeIds: ["shape1", "nonexistent"] },
      "test-user",
    );

    expect(result.success).toBe(true); // Should succeed with valid shapes
  });
});
