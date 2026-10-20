// The renderer never chooses the agent cwd. Only a path the folder picker
// already checked against the bridge roots is passed to the sidecar.
import { pathAllowed } from "./workspaceRoots.js";

export function cwdForAgent(_fromRenderer: string | undefined, pickerChosen: string | null): string | undefined {
  if (!pickerChosen) return undefined;
  return pickerChosen;
}

export async function approvedWorkspace(
  roots: readonly string[],
  chosen: string | null,
): Promise<string | undefined> {
  if (!chosen) return undefined;
  if (!(await pathAllowed(roots, chosen))) return undefined;
  return chosen;
}
