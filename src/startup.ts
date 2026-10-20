export interface HostSteps {
  createWindow: () => void | Promise<void>;
  attachTray: () => void;
  startSidecar: () => void | Promise<void>;
  log: (line: string) => void;
}

export function trayFailureLine(err: unknown): string {
  const raw = err instanceof Error ? err.message : "unknown";
  const cleaned = raw.replace(/[A-Za-z0-9+/=_-]{12,}/g, "[redacted]");
  return `tray failed: ${cleaned}`.slice(0, 180);
}

export async function startHost(steps: HostSteps): Promise<void> {
  await steps.createWindow();
  try {
    steps.attachTray();
  } catch (err) {
    steps.log(trayFailureLine(err));
  }
  await steps.startSidecar();
}
