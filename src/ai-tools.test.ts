import { describe, expect, it } from "vitest";
import { Doc } from "yjs";
import { dispatchTool, getAllShapes, TOOL_SCHEMA } from "./ai-tools";

describe("AI Tools - basics", () => {
  it("exposes a tool schema with basic tools present", () => {
    const names = TOOL_SCHEMA.map((t) => t.name);
    expect(names).toContain("createShape");
    expect(names).toContain("moveShape");
    expect(names).toContain("getCanvasState");
  });

  it("creates and moves a rectangle atomically", async () => {
    const doc = new Doc();

    const ctx = { doc, userId: "u1", userName: "User", now: Date.now() };

    doc.transact(() => {
      const res1 = dispatchTool(ctx, {
        name: "createShape",
        arguments: {
          type: "rectangle",
          x: 100,
          y: 200,
          width: 120,
          height: 80,
          fill: "red",
        },
      });
      if (res1 instanceof Promise) throw new Error("unexpected async");
      expect(res1.ok).toBe(true);
      const id = (res1.data as { id: string }).id;
      expect(typeof id).toBe("string");

      const res2 = dispatchTool(ctx, {
        name: "moveShape",
        arguments: { shapeId: id, x: 300, y: 400 },
      });
      if (res2 instanceof Promise) throw new Error("unexpected async");
      expect(res2.ok).toBe(true);
    });

    const shapes = getAllShapes(doc);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].x).toBe(300);
    expect(shapes[0].y).toBe(400);
    expect(shapes[0].fill).toBe("#FF0000");
    expect(shapes[0].createdBy).toBe("ai-assistant");
  });
});
