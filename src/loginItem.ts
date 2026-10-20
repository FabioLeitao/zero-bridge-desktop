// Electron writes the XDG autostart entry itself. The shell does not raise privileges.
export function loginItemSettings(optIn: boolean | undefined): { openAtLogin: boolean } {
  return { openAtLogin: optIn === true };
}
