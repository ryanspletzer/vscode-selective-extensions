import * as assert from "assert";
import {
  isLoopGuardSet,
  setLoopGuard,
  clearLoopGuard,
} from "../../loopGuard";

suite("loopGuard", () => {
  const ENV_KEY = "SELECTIVE_EXTENSIONS_APPLIED";

  teardown(() => {
    delete process.env[ENV_KEY];
  });

  test("isLoopGuardSet returns false when env var is not set", () => {
    delete process.env[ENV_KEY];
    assert.strictEqual(isLoopGuardSet(), false);
  });

  test("isLoopGuardSet returns true when env var is set to 1", () => {
    process.env[ENV_KEY] = "1";
    assert.strictEqual(isLoopGuardSet(), true);
  });

  test("isLoopGuardSet returns false for non-1 values", () => {
    process.env[ENV_KEY] = "true";
    assert.strictEqual(isLoopGuardSet(), false);
  });

  test("setLoopGuard sets the env var to 1", () => {
    setLoopGuard();
    assert.strictEqual(process.env[ENV_KEY], "1");
  });

  test("clearLoopGuard removes the env var", () => {
    process.env[ENV_KEY] = "1";
    clearLoopGuard();
    assert.strictEqual(process.env[ENV_KEY], undefined);
  });

  test("full cycle: set, check, clear, check", () => {
    assert.strictEqual(isLoopGuardSet(), false);
    setLoopGuard();
    assert.strictEqual(isLoopGuardSet(), true);
    clearLoopGuard();
    assert.strictEqual(isLoopGuardSet(), false);
  });
});
