import { join } from "node:path";

// Per-launch token files live here, never in the working directory and never
// at a path chosen by the renderer.
export function defaultTokenDir(userData: string): string {
  if (!userData) throw new Error("userData required");
  return join(userData, "tokens");
}
