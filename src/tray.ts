import type { ShellStrings } from "./shellLocale.js";
import { shellStrings } from "./shellLocale.js";

export interface TrayWindow {
  isVisible(): boolean;
  isFocused(): boolean;
  isMinimized(): boolean;
  show(): void;
  hide(): void;
  focus(): void;
  restore(): void;
  webContents: { send(channel: string, payload?: unknown): void };
}

export interface TrayIcon {
  on(event: "click" | "double-click", listener: () => void): void;
  setContextMenu(menu: unknown): void;
  setToolTip(text: string): void;
  destroy(): void;
}

export interface TrayMenuItem {
  label?: string;
  type?: "separator";
  click?: () => void;
}

export interface TrayBackend {
  create(iconPath: string): TrayIcon;
  buildMenu(template: TrayMenuItem[]): unknown;
}

export class TrayController {
  private tray: TrayIcon | null = null;
  private mainWindow: TrayWindow | null = null;

  constructor(
    private iconPath: string,
    private backend: TrayBackend | null = null,
    private onQuit: () => void = () => {},
    private labels: ShellStrings = shellStrings("en"),
  ) {}

  setLabels(labels: ShellStrings) {
    this.labels = labels;
    if (this.tray) this.tray.setContextMenu(this.buildMenu());
  }

  attach(window: TrayWindow) {
    if (!this.backend) throw new Error("tray backend required");
    this.mainWindow = window;
    this.tray = this.backend.create(this.iconPath);

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
    return this.backend!.buildMenu([
      {
        label: this.labels.show,
        click: () => this.show(),
      },
      { type: "separator" },
      {
        label: this.labels.quit,
        click: () => this.onQuit(),
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