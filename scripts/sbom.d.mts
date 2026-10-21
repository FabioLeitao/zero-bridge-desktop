export function bridgeComponents(record: {
  pin: string;
  modules: Array<{ path: string; version: string; go?: string }>;
}): Array<Record<string, unknown>>;

export function addBundledBridge<T extends { components?: unknown[] }>(
  sbom: T,
  record: { pin: string; modules: Array<{ path: string; version: string; go?: string }> },
): T & { components: unknown[] };
