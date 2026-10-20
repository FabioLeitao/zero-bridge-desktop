// Folder picker for workspace selection (S23b).
// Validates against bridge's --workspace-root allowlist.
// Returns absolute path or null.
// The Electron dialog is injected so unit tests do not load the electron module.
import { resolve } from "node:path";

export interface PickerWindow {}

export interface FolderDialog {
  showOpenDialog(
    win: PickerWindow,
    opts: { title: string; properties: string[]; buttonLabel: string },
  ): Promise<{ canceled: boolean; filePaths: string[] }>;
  showMessageBox(
    win: PickerWindow,
    opts: { type: string; title: string; message: string; detail: string; buttons: string[] },
  ): Promise<unknown>;
}

export class FolderPicker {
  private allowedRoots: string[] = [];

  // Called at startup after we fetch /v1/capabilities (or /v1/workspace-roots).
  setAllowedRoots(roots: string[]) {
    this.allowedRoots = roots.map(r => resolve(r));
  }

  // Returns the chosen absolute path or null if cancelled/invalid.
  async pick(mainWindow: PickerWindow, dlg: FolderDialog): Promise<string | null> {
    if (this.allowedRoots.length === 0) {
      // Fallback: allow any directory if no roots advertised yet.
      const res = await dlg.showOpenDialog(mainWindow, {
        title: "Select workspace for new session",
        properties: ["openDirectory", "createDirectory"],
        buttonLabel: "Choose",
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      return resolve(res.filePaths[0]);
    }

    // Show dialog; we'll validate after selection.
    const res = await dlg.showOpenDialog(mainWindow, {
      title: "Select workspace for new session",
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "Choose",
    });

    if (res.canceled || res.filePaths.length === 0) return null;
    const chosen = resolve(res.filePaths[0]);

    // Validate: must be inside at least one allowed root.
    for (const root of this.allowedRoots) {
      if (chosen.startsWith(root + "/") || chosen === root) {
        return chosen;
      }
    }

    // Invalid: outside allowed roots.
    await dlg.showMessageBox(mainWindow, {
      type: "error",
      title: "Workspace not allowed",
      message: `The chosen folder is outside the allowed workspace roots.`,
      detail: `Allowed roots:\n${this.allowedRoots.map(r => `  ${r}`).join("\n")}`,
      buttons: ["OK"],
    });
    return null;
  }

  // Called when a folder is dropped on the window (drag & drop).
  // We reuse the same validation.
  async handleDrop(paths: string[]): Promise<string | null> {
    if (paths.length === 0) return null;
    const chosen = resolve(paths[0]);
    for (const root of this.allowedRoots) {
      if (chosen.startsWith(root + "/") || chosen === root) {
        return chosen;
      }
    }
    return null;
  }
}