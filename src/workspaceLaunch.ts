// The renderer never chooses the agent cwd. Only a path the folder picker
// already checked against the bridge roots is passed to the sidecar.
export function cwdForAgent(_fromRenderer: string | undefined, pickerChosen: string | null): string | undefined {
  if (!pickerChosen) return undefined;
  return pickerChosen;
}
