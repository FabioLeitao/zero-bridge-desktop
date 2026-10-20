export interface QuitEvent {
  preventDefault(): void;
}

export interface QuitState {
  quitting: boolean;
}

// Electron does not wait for an async before-quit listener. Hold the quit
// until kill finishes, then quit again. The second event must not hold.
export function holdQuit(
  event: QuitEvent,
  state: QuitState,
  actions: { kill: () => Promise<void>; quit: () => void },
): void {
  if (state.quitting) return;
  event.preventDefault();
  state.quitting = true;
  void actions.kill().finally(() => actions.quit());
}
