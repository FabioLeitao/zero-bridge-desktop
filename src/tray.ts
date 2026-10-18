import { Tray, Menu, ipcMain, BrowserWindow } from "electron";
import { join } from "node:path";
import { IPC_CHANNELS } from "./types.js";

export class TrayController {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(private iconPath: string) {}

  attach(window: BrowserWindow) {
    this.mainWindow = window;
    this.tray = new Tray(this.iconPath);

    this.tray.on("click", () => this.toggle());
    this.tray.on("double-click", () => this.show());

    this.tray.setContextMenu(this.buildMenu());
    this.tray.setToolTip("zero-bridge");
  }

  private toggle() {
    if (!this.mainWindow) return;
    if (this.mainWindow.isVisible() && this.mainWindow.isFocused()) {
      this.hide();
    } else {
      this.show();
    }
  }

  private show() {
    if (!this.mainWindow) return;
    this.mainWindow.show();
    this.mainWindow.focus();
    this.tray?.setContextMenu(this.buildMenu());
  }

  private hide() {
    this.mainWindow?.hide();
  }

  private buildMenu() {
    return Menu.buildFromTemplate([
      {
        label: "Show zero-bridge",
        click: () => this.show(),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          this.mainWindow?.webContents.send(IPC_CHANNELS.QUIT);
        },
      },
    ]);
  }

  updateTooltip(text: string) {
    this.tray?.setToolTip(text);
  }

  destroy() {
    this.tray?.destroy();
    this.tray = null;
  }
}