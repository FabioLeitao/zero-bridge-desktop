// Native notification for permission requests (S23b).
// Text-only: only the tool title from the permission card is shown.
// Nothing from agent output beyond that.
// The Electron Notification constructor is injected so tests do not load electron.

import { IPC_CHANNELS } from "./types.js";
import { appendRedactedLog } from "./redactLog.js";
import { shellStrings, type ShellStrings } from "./shellLocale.js";

export interface NoticeWindow {
  isVisible(): boolean;
  isFocused(): boolean;
  show(): void;
  focus(): void;
  webContents: { send(channel: string, payload: unknown): void };
}

export interface ShownNote {
  on(event: "click", listener: () => void): void;
  show(): void;
  close(): void;
}

export type NoteFactory = (opts: {
  title: string;
  body: string;
  urgency: "critical";
}) => ShownNote;

export interface PermissionNotice {
  toolTitle: string;
  sessionId: string;
  reqId: string;
}

export class PermissionNotifier {
  private pending: PermissionNotice[] = [];
  private mainWindow: NoticeWindow | null = null;

  constructor(
    private readonly notes: NoteFactory,
    private readonly noteLogPath: () => string | undefined = () => undefined,
    private strings: ShellStrings = shellStrings("en"),
  ) {}

  setStrings(strings: ShellStrings) {
    this.strings = strings;
  }

  attach(window: NoticeWindow) {
    this.mainWindow = window;
  }

  // Called by the main process when it sees a permission_request event
  // on the SSE stream. The tool title is the only allowed text.
  onPermissionRequest(notice: PermissionNotice) {
    this.pending.push(notice);

    if (this.mainWindow?.isVisible() && this.mainWindow?.isFocused()) {
      // Window is visible: no native notification, the card is on screen.
      return;
    }

    const title = sanitizeToolTitle(notice.toolTitle);
    const body = this.strings.permissionBody(title);

    const n = this.notes({
      title: this.strings.permissionTitle,
      body,
      urgency: "critical",
    });

    n.on("click", () => {
      this.focusOnPermission(notice);
      n.close();
    });

    n.show();
    const noteLog = this.noteLogPath();
    if (noteLog) appendRedactedLog(noteLog, body);
  }

  private focusOnPermission(notice: PermissionNotice) {
    if (!this.mainWindow) return;
    this.mainWindow.show();
    this.mainWindow.focus();
    // Tell the renderer to scroll to the card.
    this.mainWindow.webContents.send(IPC_CHANNELS.PERMISSION_FOCUS, {
      reqId: notice.reqId,
      sessionId: notice.sessionId,
    });
  }
}

export function sanitizeToolTitle(text: string): string {
  return String(text ?? "")
    .replace(/[<>&"'\r\n]/g, "")
    .slice(0, 80);
}