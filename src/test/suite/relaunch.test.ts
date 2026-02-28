import * as assert from "assert";
import { buildArgs } from "../../relaunch";

suite("relaunch.buildArgs", () => {
  test("builds args with single disable ID", () => {
    const args = buildArgs("/path/to/workspace", ["ext-a"]);
    assert.deepStrictEqual(args, [
      "--new-window",
      "/path/to/workspace",
      "--disable-extension",
      "ext-a",
    ]);
  });

  test("builds args with multiple disable IDs", () => {
    const args = buildArgs("/path/to/workspace", ["ext-a", "ext-b", "ext-c"]);
    assert.deepStrictEqual(args, [
      "--new-window",
      "/path/to/workspace",
      "--disable-extension",
      "ext-a",
      "--disable-extension",
      "ext-b",
      "--disable-extension",
      "ext-c",
    ]);
  });

  test("builds args with empty disable list", () => {
    const args = buildArgs("/path/to/workspace", []);
    assert.deepStrictEqual(args, ["--new-window", "/path/to/workspace"]);
  });

  test("handles workspace path with spaces", () => {
    const args = buildArgs("/path/to/my workspace", ["ext-a"]);
    assert.strictEqual(args[1], "/path/to/my workspace");
  });

  test("handles Windows-style paths", () => {
    const args = buildArgs("C:\\Users\\user\\project", ["ext-a"]);
    assert.strictEqual(args[1], "C:\\Users\\user\\project");
  });

  test("handles .code-workspace file path", () => {
    const args = buildArgs("/path/to/project.code-workspace", ["ext-a"]);
    assert.strictEqual(args[1], "/path/to/project.code-workspace");
  });
});
