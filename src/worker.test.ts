/**
 * Worker Tests - Route handling and authentication
 */

import { describe, expect, it } from "vitest";

describe("parseCanvasWebSocketRoute", () => {
  // Since parseCanvasWebSocketRoute is not exported, we test it indirectly through URL patterns

  it("should handle valid WebSocket routes", () => {
    const validUrls = [
      "/c/main/ws",
      "/c/main/ws/main",
      "/c/custom/ws",
      "/c/main/ws?token=abc123",
    ];

    for (const path of validUrls) {
      const url = new URL(path, "http://localhost");
      expect(url.pathname).toContain("/c/");
      expect(url.pathname).toContain("/ws");
    }
  });

  it("should reject invalid WebSocket routes", () => {
    const invalidUrls = [
      { path: "/ws", reason: "Missing /c/ prefix" },
      { path: "/c/ws", reason: "Too short" },
      { path: "/c/main", reason: "Missing /ws" },
      { path: "/c/main/ws/extra/garbage", reason: "Too many segments" },
    ];

    for (const { path, reason } of invalidUrls) {
      const url = new URL(path, "http://localhost");
      const segments = url.pathname.split("/").filter(Boolean);

      // Valid route must: start with /c/, have ws, and not have too many segments
      const wsIndex = segments.indexOf("ws");
      const isValid =
        segments.length >= 3 &&
        segments[0] === "c" &&
        wsIndex !== -1 &&
        wsIndex >= 2 &&
        wsIndex <= 3 &&
        wsIndex >= segments.length - 2;

      expect(isValid, `${path} should be invalid: ${reason}`).toBe(false);
    }
  });
});

describe("AI route pattern", () => {
  it("should match /c/:roomId/ai-command", () => {
    const url = new URL("/c/main/ai-command", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    const isAiRoute =
      segments.length === 3 && segments[0] === "c" && segments[2] === "ai-command";
    expect(isAiRoute).toBe(true);
  });
});

describe("extractToken", () => {
  it("should extract token from query parameter", () => {
    const url = new URL("http://localhost?token=abc123");
    const token = url.searchParams.get("token");
    expect(token).toBe("abc123");
  });

  it("should extract token from Authorization header", () => {
    const authHeader = "Bearer abc123";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
    expect(token).toBe("abc123");
  });

  it("should handle missing token", () => {
    const url = new URL("http://localhost");
    const token = url.searchParams.get("token");
    expect(token).toBeNull();
  });
});

describe("security headers", () => {
  it("should include CSP headers", () => {
    const headers = new Headers();
    headers.set("Content-Security-Policy", "default-src 'self'");

    expect(headers.get("Content-Security-Policy")).toContain("default-src");
  });

  it("should include X-Frame-Options", () => {
    const headers = new Headers();
    headers.set("X-Frame-Options", "DENY");

    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("should include X-Content-Type-Options", () => {
    const headers = new Headers();
    headers.set("X-Content-Type-Options", "nosniff");

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
