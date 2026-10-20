// Minimal renderer for smoke tests. The real UI is the bridge web UI loaded from the sidecar.
type ZB = {
  launch: () => Promise<any>;
  quit: () => void;
  onState: (cb: (e: any) => void) => void;
};

declare global {
  interface Window { zb?: ZB; }
}

export async function launchSidecar() {
  if (!window.zb) throw new Error("ZB preload not ready");
  const res = await window.zb.launch();
  if (!res.ok) throw new Error(res.error || "launch failed");
  // Navigate to the bridge UI.
  if (res.url) {
    const nav = document.createElement("a");
    nav.href = res.url;
    // The main process blocks navigation outside sidecar origin.
    // We rely on the main process to load the page.
    window.location.assign(res.url);
  }
  return res;
}