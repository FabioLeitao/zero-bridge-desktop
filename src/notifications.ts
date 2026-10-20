// Native notification for permission requests (S23b).
// Text-only: only the tool title from the permission card is shown.
// Nothing from agent output beyond that.
import { Notification } from "electron";
import { BrowserWindow } from "electron";

export interface PermissionNotice {
  toolTitle: string;
  sessionId: string;
  reqId: string;
}

export class PermissionNotifier {
  private pending: PermissionNotice[] = [];
  private mainWindow: BrowserWindow | null = null;

  attach(window: BrowserWindow) {
    this.mainWindow = window;
  }

  // Called by the main process when it sees a permission_request event
  // on the SSE stream. The tool title is the only allowed text.
  onPermissionRequest(notice: PermissionNotice) {
    this.pending.push(notice);

    if (!Notification.isSupported()) return;
    if (this.mainWindow?.isVisible() && this.mainWindow?.isFocused()) {
      // Window is visible: no native notification, the card is on screen.
      return;
    }

    const title = this.sanitizeText(notice.toolTitle);
    const body = `Permission requested: ${title}`;

    const n = new Notification({
      title: "zero-bridge permission",
      body,
      urgency: "critical",
    });

    n.on("click", () => {
      this.focusOnPermission(notice);
      n.close();
    });

    n.show();
  }

  private focusOnPermission(notice: PermissionNotice) {
    if (!this.mainWindow) return;
    this.mainWindow.show();
    this.mainWindow.focus();
    // Tell the renderer to scroll to the card.
    this.mainWindow.webContents.send("zb:permission-focus", {
      reqId: notice.reqId,
      sessionId: notice.sessionId,
    });
  }

  private sanitizeText(text: string): string {
    // Strip anything that could carry markup or script.
    return String(text ?? "").replace(/[<>&"']/g, "");
  }
}