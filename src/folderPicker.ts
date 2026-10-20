// Folder picker for workspace selection (S23b).
// Validates against bridge's --workspace-root allowlist.
// Returns absolute path or null.
// The Electron dialog is injected so unit tests do not load the electron module.
import { resolve } from "node:path";
import { pathAllowed } from "./workspaceRoots.js";

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
  private validated: string | null = null;

  // Called at startup after we fetch /v1/capabilities (or /v1/workspace-roots).
  setAllowedRoots(roots: string[]) {
    this.allowedRoots = roots.filter((root) => root.length > 0);
    this.validated = null;
  }

  roots(): readonly string[] {
    return this.allowedRoots;
  }

  chosen(): string | null {
    return this.validated;
  }

  // Returns the chosen absolute path or null if cancelled/invalid.
  // An empty allowlist refuses the dialog. There is no fallback to every directory.
  async pick(mainWindow: PickerWindow, dlg: FolderDialog): Promise<string | null> {
    if (this.allowedRoots.length === 0) return null;

    const res = await dlg.showOpenDialog(mainWindow, {
      title: "Select workspace for new session",
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "Choose",
    });

    if (res.canceled || res.filePaths.length === 0) return null;
    const chosen = resolve(res.filePaths[0]);
    if (await pathAllowed(this.allowedRoots, chosen)) {
      this.validated = chosen;
      return chosen;
    }

    await dlg.showMessageBox(mainWindow, {
      type: "error",
      title: "Workspace not allowed",
      message: "The chosen folder is outside the allowed workspace roots.",
      detail: `Allowed roots:\n${this.allowedRoots.map((r) => `  ${r}`).join("\n")}`,
      buttons: ["OK"],
    });
    return null;
  }

  // Called when a folder is dropped on the window (drag & drop).
  async handleDrop(paths: string[]): Promise<string | null> {
    if (paths.length === 0 || this.allowedRoots.length === 0) return null;
    const chosen = resolve(paths[0]);
    if (await pathAllowed(this.allowedRoots, chosen)) {
      this.validated = chosen;
      return chosen;
    }
    return null;
  }
}