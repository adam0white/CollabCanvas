import { describe, expect, it } from "vitest";

import { hello } from "./index";

describe("hello", () => {
  it("returns the project name", () => {
    expect(hello()).toBe("CollabCanvas");
  });
});
