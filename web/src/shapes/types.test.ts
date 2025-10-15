/**
 * Shape Types Tests
 */

import { describe, expect, it } from "vitest";
import { createRectangle, isRectangle } from "./types";

describe("createRectangle", () => {
  it("should create a rectangle with correct properties", () => {
    const rect = createRectangle(10, 20, 100, 50, "user123");

    expect(rect.type).toBe("rectangle");
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
    expect(rect.createdBy).toBe("user123");
    expect(rect.id).toBeTruthy();
    expect(rect.createdAt).toBeGreaterThan(0);
  });

  it("should create rectangles with unique IDs", () => {
    const rect1 = createRectangle(0, 0, 100, 100, "user1");
    const rect2 = createRectangle(0, 0, 100, 100, "user1");

    expect(rect1.id).not.toBe(rect2.id);
  });

  it("should use default fill color", () => {
    const rect = createRectangle(0, 0, 100, 100, "user1");
    expect(rect.fill).toBe("#38bdf8");
  });

  it("should accept custom fill color", () => {
    const rect = createRectangle(0, 0, 100, 100, "user1", "#ff0000");
    expect(rect.fill).toBe("#ff0000");
  });
});

describe("isRectangle", () => {
  it("should return true for rectangle shapes", () => {
    const rect = createRectangle(0, 0, 100, 100, "user1");
    expect(isRectangle(rect)).toBe(true);
  });

  it("should validate type property", () => {
    const rect = createRectangle(0, 0, 100, 100, "user1");
    expect(rect.type).toBe("rectangle");
    expect(isRectangle(rect)).toBe(true);
  });
});
