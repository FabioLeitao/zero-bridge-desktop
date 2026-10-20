// Second process must exit. The first keeps the window.
export function singleInstanceDecision(gotLock: boolean): "continue" | "quit" {
  return gotLock ? "continue" : "quit";
}
