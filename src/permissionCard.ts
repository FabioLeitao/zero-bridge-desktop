export interface CardNotice {
  toolTitle: string;
  sessionId: string;
  reqId: string;
}

export function noticeFromCard(title: string, labelledBy: string): CardNotice | null {
  const toolTitle = title.trim();
  const reqId = labelledBy.trim();
  if (!toolTitle || !reqId) return null;
  if (toolTitle.length > 200 || reqId.length > 80) return null;
  return { toolTitle, sessionId: "page", reqId };
}
