/**
 * AI Tools Extended Test Suite
 *
 * Tests for PR11 tools:
 * - resizeShape
 * - rotateShape
 * - updateShapeStyle
 * - deleteShape
 * - arrangeShapes
 * - findShapes
 */

import { describe, expect, it } from "vitest";
import { Doc } from "yjs";
import {
  arrangeShapes,
  deleteShape,
  findShapes,
  resizeShape,
  rotateShape,
  updateShapeStyle,
} from "./ai-tools";

describe("AI Tools - resizeShape", () => {
  it("should resize a rectangle with absolute dimensions", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = resizeShape(
      doc,
      { shapeId, width: 200, height: 150 },
      "test-user",
    );

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { width: number }).width).toBe(200);
    expect((updated as { height: number }).height).toBe(150);
  });

  it("should resize a circle by radius", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-circle";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "circle",
      x: 100,
      y: 100,
      radius: 25,
    });

    const result = resizeShape(doc, { shapeId, radius: 75 }, "test-user");

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { radius: number }).radius).toBe(75);
  });

  it("should resize by scale factor", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 50,
    });

    const result = resizeShape(doc, { shapeId, scale: 2 }, "test-user");

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { width: number }).width).toBe(200);
    expect((updated as { height: number }).height).toBe(100);
  });

  it("should reject invalid dimensions", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = resizeShape(
      doc,
      { shapeId, width: 5 }, // Too small
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid");
  });
});

describe("AI Tools - rotateShape", () => {
  it("should rotate a shape to specified angle", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = rotateShape(doc, { shapeId, rotation: 45 }, "test-user");

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { rotation: number }).rotation).toBe(45);
  });

  it("should normalize negative angles", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = rotateShape(doc, { shapeId, rotation: -45 }, "test-user");

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { rotation: number }).rotation).toBe(315); // 360 - 45
  });

  it("should normalize angles over 360", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = rotateShape(doc, { shapeId, rotation: 405 }, "test-user");

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { rotation: number }).rotation).toBe(45); // 405 % 360
  });
});

describe("AI Tools - updateShapeStyle", () => {
  it("should update shape fill color", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      fill: "#FF0000",
    });

    const result = updateShapeStyle(
      doc,
      { shapeId, fill: "blue" },
      "test-user",
    );

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { fill: string }).fill).toBe("#0000FF");
  });

  it("should update stroke properties", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = updateShapeStyle(
      doc,
      { shapeId, stroke: "red", strokeWidth: 3 },
      "test-user",
    );

    expect(result.success).toBe(true);
    const updated = shapesMap.get(shapeId);
    expect((updated as { stroke: string }).stroke).toBe("#FF0000");
    expect((updated as { strokeWidth: number }).strokeWidth).toBe(3);
  });
});

describe("AI Tools - deleteShape", () => {
  it("should delete an existing shape", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");
    const shapeId = "test-shape";

    shapesMap.set(shapeId, {
      id: shapeId,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    });

    const result = deleteShape(doc, { shapeId }, "test-user");

    expect(result.success).toBe(true);
    expect(shapesMap.has(shapeId)).toBe(false);
  });

  it("should be idempotent - succeed even if shape doesn't exist", () => {
    const doc = new Doc();
    const result = deleteShape(doc, { shapeId: "nonexistent" }, "test-user");

    expect(result.success).toBe(true);
  });
});

describe("AI Tools - arrangeShapes", () => {
  it("should arrange shapes horizontally", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    const shapeIds = ["shape1", "shape2", "shape3"];
    for (let i = 0; i < shapeIds.length; i++) {
      shapesMap.set(shapeIds[i], {
        id: shapeIds[i],
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      });
    }

    const result = arrangeShapes(
      doc,
      { shapeIds, layout: "horizontal", spacing: 20 },
      "test-user",
    );

    expect(result.success).toBe(true);

    const shape1 = shapesMap.get("shape1");
    const shape2 = shapesMap.get("shape2");
    const shape3 = shapesMap.get("shape3");

    expect((shape1 as { x: number }).x).toBe(0);
    expect((shape2 as { x: number }).x).toBe(70); // 0 + 50 + 20
    expect((shape3 as { x: number }).x).toBe(140); // 70 + 50 + 20
  });

  it("should arrange shapes vertically", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    const shapeIds = ["shape1", "shape2", "shape3"];
    for (let i = 0; i < shapeIds.length; i++) {
      shapesMap.set(shapeIds[i], {
        id: shapeIds[i],
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      });
    }

    const result = arrangeShapes(
      doc,
      { shapeIds, layout: "vertical", spacing: 10 },
      "test-user",
    );

    expect(result.success).toBe(true);

    const shape1 = shapesMap.get("shape1");
    const shape2 = shapesMap.get("shape2");
    const shape3 = shapesMap.get("shape3");

    expect((shape1 as { y: number }).y).toBe(0);
    expect((shape2 as { y: number }).y).toBe(60); // 0 + 50 + 10
    expect((shape3 as { y: number }).y).toBe(120); // 60 + 50 + 10
  });

  it("should arrange shapes in a grid", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    const shapeIds = ["shape1", "shape2", "shape3", "shape4"];
    for (let i = 0; i < shapeIds.length; i++) {
      shapesMap.set(shapeIds[i], {
        id: shapeIds[i],
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      });
    }

    const result = arrangeShapes(
      doc,
      { shapeIds, layout: "grid", columns: 2, spacing: 20 },
      "test-user",
    );

    expect(result.success).toBe(true);

    const shape1 = shapesMap.get("shape1");
    const shape2 = shapesMap.get("shape2");
    const shape3 = shapesMap.get("shape3");
    const shape4 = shapesMap.get("shape4");

    // First row
    expect((shape1 as { x: number }).x).toBe(0);
    expect((shape1 as { y: number }).y).toBe(0);
    expect((shape2 as { x: number }).x).toBe(70); // 0 + 50 + 20

    // Second row
    expect((shape3 as { x: number }).x).toBe(0);
    expect((shape3 as { y: number }).y).toBe(70); // 0 + 50 + 20
    expect((shape4 as { x: number }).x).toBe(70);
  });

  it("should fail if shape not found", () => {
    const doc = new Doc();
    const result = arrangeShapes(
      doc,
      { shapeIds: ["nonexistent"], layout: "horizontal" },
      "test-user",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("AI Tools - findShapes", () => {
  it("should find shapes by type", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    shapesMap.set("rect1", { id: "rect1", type: "rectangle", x: 0, y: 0 });
    shapesMap.set("circle1", { id: "circle1", type: "circle", x: 0, y: 0 });
    shapesMap.set("rect2", { id: "rect2", type: "rectangle", x: 0, y: 0 });

    const result = findShapes(doc, { type: "rectangle" }, "test-user");

    expect(result.success).toBe(true);
    expect(result.shapeIds).toHaveLength(2);
    expect(result.shapeIds).toContain("rect1");
    expect(result.shapeIds).toContain("rect2");
  });

  it("should find shapes by color", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    shapesMap.set("red1", {
      id: "red1",
      type: "rectangle",
      x: 0,
      y: 0,
      fill: "#FF0000",
    });
    shapesMap.set("blue1", {
      id: "blue1",
      type: "rectangle",
      x: 0,
      y: 0,
      fill: "#0000FF",
    });
    shapesMap.set("red2", {
      id: "red2",
      type: "circle",
      x: 0,
      y: 0,
      fill: "red",
    });

    const result = findShapes(doc, { color: "red" }, "test-user");

    expect(result.success).toBe(true);
    expect(result.shapeIds).toHaveLength(2);
    expect(result.shapeIds).toContain("red1");
    expect(result.shapeIds).toContain("red2");
  });

  it("should find text shapes by content", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    shapesMap.set("text1", {
      id: "text1",
      type: "text",
      x: 0,
      y: 0,
      text: "Hello World",
    });
    shapesMap.set("text2", {
      id: "text2",
      type: "text",
      x: 0,
      y: 0,
      text: "Goodbye",
    });
    shapesMap.set("text3", {
      id: "text3",
      type: "text",
      x: 0,
      y: 0,
      text: "Hello there",
    });

    const result = findShapes(doc, { contains: "Hello" }, "test-user");

    expect(result.success).toBe(true);
    expect(result.shapeIds).toHaveLength(2);
    expect(result.shapeIds).toContain("text1");
    expect(result.shapeIds).toContain("text3");
  });

  it("should find shapes by multiple criteria", () => {
    const doc = new Doc();
    const shapesMap = doc.getMap("shapes");

    shapesMap.set("match", {
      id: "match",
      type: "rectangle",
      x: 0,
      y: 0,
      fill: "#FF0000",
    });
    shapesMap.set("nomatch1", {
      id: "nomatch1",
      type: "circle",
      x: 0,
      y: 0,
      fill: "#FF0000",
    });
    shapesMap.set("nomatch2", {
      id: "nomatch2",
      type: "rectangle",
      x: 0,
      y: 0,
      fill: "#0000FF",
    });

    const result = findShapes(
      doc,
      { type: "rectangle", color: "red" },
      "test-user",
    );

    expect(result.success).toBe(true);
    expect(result.shapeIds).toHaveLength(1);
    expect(result.shapeIds).toContain("match");
  });

  it("should return empty array when no matches", () => {
    const doc = new Doc();
    const result = findShapes(doc, { type: "circle" }, "test-user");

    expect(result.success).toBe(true);
    expect(result.shapeIds).toHaveLength(0);
  });
});
