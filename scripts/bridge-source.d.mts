export function parsePin(text: string): string;
export function readPin(repoRoot: string): string;
export function withBridgeCheckout<T>(
  repoRoot: string,
  use: (checkout: { pin: string; moduleDir: string }) => T,
): T;
