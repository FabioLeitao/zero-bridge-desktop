// ZB_E2E_* exists for the unpackaged test harness. A packaged app ignores it.
export interface TestHooks {
  bridgeBin?: string;
  agentBin?: string;
  port?: string;
  tokenFile?: string;
  noteLog?: string;
}

export function testHooks(env: NodeJS.ProcessEnv, packaged: boolean): TestHooks {
  if (packaged) return {};
  return {
    bridgeBin: present(env.ZB_E2E_BRIDGE_BIN),
    agentBin: present(env.ZB_E2E_AGENT_BIN),
    port: present(env.ZB_E2E_PORT),
    tokenFile: present(env.ZB_E2E_TOKEN_FILE),
    noteLog: present(env.ZB_E2E_NOTE_LOG),
  };
}

function present(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
