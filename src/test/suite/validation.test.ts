import * as assert from "assert";
import { isValidExtensionId } from "../../config";

suite("config.isValidExtensionId", () => {
  test("accepts standard publisher.name format", () => {
    assert.strictEqual(isValidExtensionId("ms-python.python"), true);
    assert.strictEqual(isValidExtensionId("esbenp.prettier-vscode"), true);
    assert.strictEqual(isValidExtensionId("dbaeumer.vscode-eslint"), true);
  });

  test("accepts IDs with dots in the name segment", () => {
    assert.strictEqual(
      isValidExtensionId("ms-dotnettools.csharp"),
      true,
    );
    assert.strictEqual(
      isValidExtensionId("publisher.name.with.dots"),
      true,
    );
  });

  test("accepts IDs with underscores and digits", () => {
    assert.strictEqual(isValidExtensionId("pub_1.ext_2"), true);
    assert.strictEqual(isValidExtensionId("my-pub.my-ext123"), true);
  });

  test("rejects IDs without a dot separator", () => {
    assert.strictEqual(isValidExtensionId("nodot"), false);
    assert.strictEqual(isValidExtensionId("just-a-name"), false);
  });

  test("rejects empty string", () => {
    assert.strictEqual(isValidExtensionId(""), false);
  });

  test("rejects CLI flags that could be argument injection", () => {
    assert.strictEqual(isValidExtensionId("--force"), false);
    assert.strictEqual(isValidExtensionId("--disable-extension"), false);
    assert.strictEqual(isValidExtensionId("-v"), false);
  });

  test("rejects IDs with spaces", () => {
    assert.strictEqual(isValidExtensionId("pub. ext"), false);
    assert.strictEqual(isValidExtensionId("pub .ext"), false);
  });

  test("rejects IDs with shell metacharacters", () => {
    assert.strictEqual(isValidExtensionId("pub.ext;rm -rf /"), false);
    assert.strictEqual(isValidExtensionId("pub.ext|cat /etc/passwd"), false);
    assert.strictEqual(isValidExtensionId("pub.ext&&echo pwned"), false);
    assert.strictEqual(isValidExtensionId("pub.ext$(whoami)"), false);
  });

  test("rejects IDs starting or ending with a dot", () => {
    assert.strictEqual(isValidExtensionId(".ext"), false);
    assert.strictEqual(isValidExtensionId("pub."), false);
  });
});
