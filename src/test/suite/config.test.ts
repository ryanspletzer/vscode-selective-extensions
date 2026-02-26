import * as assert from "assert";
import { mergeConfig, resolveProvenance, type RawLayer } from "../../config";

suite("config.mergeConfig", () => {
  test("returns defaults when all layers are empty", () => {
    const layers: RawLayer[] = [{ source: "user" }];
    const result = mergeConfig(layers);

    assert.strictEqual(result.enabled, true);
    assert.strictEqual(result.autoApply, true);
    assert.strictEqual(result.includeBuiltins, false);
    assert.deepStrictEqual(result.enabledExtensions, []);
  });

  test("single layer with extensions populates the list", () => {
    const layers: RawLayer[] = [
      {
        source: "user",
        enabledExtensions: ["ms-python.python", "esbenp.prettier-vscode"],
      },
    ];
    const result = mergeConfig(layers);

    assert.deepStrictEqual(result.enabledExtensions, [
      "ms-python.python",
      "esbenp.prettier-vscode",
    ]);
  });

  test("union merges extensions across all levels", () => {
    const layers: RawLayer[] = [
      { source: "user", enabledExtensions: ["ext-a", "ext-b"] },
      { source: "workspace", enabledExtensions: ["ext-b", "ext-c"] },
      {
        source: "selective-extensions.json",
        enabledExtensions: ["ext-c", "ext-d"],
      },
    ];
    const result = mergeConfig(layers);

    assert.strictEqual(result.enabledExtensions.length, 4);
    assert.ok(result.enabledExtensions.includes("ext-a"));
    assert.ok(result.enabledExtensions.includes("ext-b"));
    assert.ok(result.enabledExtensions.includes("ext-c"));
    assert.ok(result.enabledExtensions.includes("ext-d"));
  });

  test("extension IDs are normalized to lowercase", () => {
    const layers: RawLayer[] = [
      { source: "user", enabledExtensions: ["MS-Python.Python"] },
      { source: "workspace", enabledExtensions: ["ms-python.python"] },
    ];
    const result = mergeConfig(layers);

    // Should be deduplicated after lowercasing
    assert.strictEqual(result.enabledExtensions.length, 1);
    assert.strictEqual(result.enabledExtensions[0], "ms-python.python");
  });

  test("scalar: highest-specificity wins for enabled", () => {
    const layers: RawLayer[] = [
      { source: "user", enabled: true },
      { source: "workspace", enabled: true },
      { source: "selective-extensions.json", enabled: false },
    ];
    const result = mergeConfig(layers);

    assert.strictEqual(result.enabled, false);
  });

  test("scalar: skips undefined levels", () => {
    const layers: RawLayer[] = [
      { source: "user", autoApply: false },
      { source: "workspace" }, // autoApply not defined
      { source: "selective-extensions.json" }, // autoApply not defined
    ];
    const result = mergeConfig(layers);

    assert.strictEqual(result.autoApply, false);
  });

  test("scalar: later level overrides earlier", () => {
    const layers: RawLayer[] = [
      { source: "user", includeBuiltins: true },
      { source: "workspace", includeBuiltins: false },
    ];
    const result = mergeConfig(layers);

    assert.strictEqual(result.includeBuiltins, false);
  });

  test("empty layers array returns defaults", () => {
    const result = mergeConfig([]);

    assert.strictEqual(result.enabled, true);
    assert.strictEqual(result.autoApply, true);
    assert.strictEqual(result.includeBuiltins, false);
    assert.deepStrictEqual(result.enabledExtensions, []);
  });
});

suite("config.resolveProvenance", () => {
  test("tracks which sources contributed each extension", () => {
    const layers: RawLayer[] = [
      { source: "user", enabledExtensions: ["ext-a", "ext-b"] },
      { source: "workspace", enabledExtensions: ["ext-b", "ext-c"] },
    ];
    const provenance = resolveProvenance(layers);

    const extA = provenance.find((p) => p.id === "ext-a");
    assert.ok(extA);
    assert.deepStrictEqual(extA.sources, ["user"]);

    const extB = provenance.find((p) => p.id === "ext-b");
    assert.ok(extB);
    assert.deepStrictEqual(extB.sources, ["user", "workspace"]);

    const extC = provenance.find((p) => p.id === "ext-c");
    assert.ok(extC);
    assert.deepStrictEqual(extC.sources, ["workspace"]);
  });

  test("returns empty array for empty layers", () => {
    const provenance = resolveProvenance([]);
    assert.deepStrictEqual(provenance, []);
  });

  test("handles layers with no extensions", () => {
    const layers: RawLayer[] = [
      { source: "user" },
      { source: "workspace", enabledExtensions: ["ext-a"] },
    ];
    const provenance = resolveProvenance(layers);

    assert.strictEqual(provenance.length, 1);
    assert.strictEqual(provenance[0].id, "ext-a");
  });
});
