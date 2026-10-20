export function resolveBridgeModule(
  input: { env?: string; nested: string; sibling: string },
  exists: (path: string) => boolean,
): string {
  if (input.env && exists(input.env)) return input.env;
  if (exists(input.nested)) return input.nested;
  if (exists(input.sibling)) return input.sibling;
  throw new Error("zero-bridge module not found");
}
