const ENV_KEY = "SELECTIVE_EXTENSIONS_APPLIED";

export function isLoopGuardSet(): boolean {
  return process.env[ENV_KEY] === "1";
}

export function setLoopGuard(): void {
  process.env[ENV_KEY] = "1";
}

export function clearLoopGuard(): void {
  delete process.env[ENV_KEY];
}
