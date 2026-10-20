function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function errorPageHtml(state: string, detail: string): string {
  const title = escapeHtml(state).slice(0, 80);
  const body = escapeHtml(detail).slice(0, 500);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>zero-bridge</title></head><body><h1>${title}</h1><p>${body}</p></body></html>`;
}
