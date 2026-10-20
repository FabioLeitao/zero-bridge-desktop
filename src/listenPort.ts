// Port 0 means "ask the OS". It must not collapse to a fixed port.
export function ephemeralPort(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "" || raw === 0 || raw === "0") return 0;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error("bad port");
  }
  return value;
}
