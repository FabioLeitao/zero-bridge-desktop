import { readFile, writeFile } from "node:fs/promises";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function validAxis(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -10000 && value <= 10000;
}

function validSize(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 200 && value <= 10000;
}

export function parseWindowBounds(raw: string): WindowBounds | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  if (!validAxis(body.x) || !validAxis(body.y) || !validSize(body.width) || !validSize(body.height)) {
    return null;
  }
  return { x: body.x, y: body.y, width: body.width, height: body.height };
}

export async function loadWindowBounds(file: string): Promise<WindowBounds | null> {
  try {
    return parseWindowBounds(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

export async function saveWindowBounds(file: string, bounds: WindowBounds): Promise<void> {
  await writeFile(file, JSON.stringify(bounds), { mode: 0o600 });
}
