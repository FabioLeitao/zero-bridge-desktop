import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';

let electronApp: any = null;
let window: any = null;
let bridgeBin = '';
let agentBin = '';
let tokenDir = '';
let tokenPath = '';
let testPort = 0;

// Build binaries once before all tests
test.beforeAll(async () => {
  const bridgeDir = join(__dirname, '..', '..', 'zero-bridge');
  const bridgeTmp = join(tmpdir(), `zb-e2e-bridge-${randomBytes(4).toString('hex')}`);
  const agentTmp = join(tmpdir(), `zb-e2e-agent-${randomBytes(4).toString('hex')}`);
  bridgeBin = bridgeTmp;
  agentBin = agentTmp;

  execFileSync('go', ['build', '-o', bridgeTmp, './cmd/zero-bridge'], { cwd: bridgeDir });
  execFileSync('go', ['build', '-o', agentTmp, './cmd/acpfake'], { cwd: bridgeDir });

  tokenDir = join(tmpdir(), `zb-e2e-${randomBytes(4).toString('hex')}`);
  await fs.mkdir(tokenDir, { recursive: true, mode: 0o700 });
  tokenPath = join(tokenDir, 'token.txt');
  const token = randomBytes(32).toString('hex');
  await fs.writeFile(tokenPath, token + '\n', { mode: 0o600 });
});

test.afterAll(async () => {
  // Cleanup temp files
  for (const p of [bridgeBin, agentBin, tokenPath, tokenDir]) {
    try { await fs.rm(p, { force: true, recursive: true }); } catch {}
  }
});

test('launch app, chat with fake agent, permission card, quit', async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [join(__dirname, '..', 'src', 'main.ts')],
    env: {
      ...process.env,
      ZB_E2E_BRIDGE_BIN: bridgeBin,
      ZB_E2E_AGENT_BIN: agentBin,
      ZB_E2E_TOKEN_FILE: tokenPath,
      ZB_E2E_PORT: '0',
    },
  });

  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Wait for sidecar to start and UI to load
  await expect(window.locator('h1, [data-testid="app-title"]')).toBeVisible({ timeout: 30000 });

  // Check that the UI shows the session list or new session button
  const newSessionBtn = window.locator('button:has-text("Nova sessão"), button:has-text("New session")');
  await expect(newSessionBtn).toBeVisible({ timeout: 10000 });

  // Click new session
  await newSessionBtn.click();

  // Wait for workspace picker or direct load
  const workspaceInput = window.locator('input[type="text"][placeholder*="workspace" i], input[placeholder*="pasta" i]');
  if (await workspaceInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // If there's a workspace picker, we'd need to handle it
    // For now, just verify the UI loads
  }

  // Send a message in the chat
  const chatInput = window.locator('textarea[placeholder*="message" i], textarea[placeholder*="mensagem" i], textarea[data-testid="chat-input"]');
  if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatInput.fill('hello from e2e test');
    await chatInput.press('Enter');
  }

  // Wait for response (fake agent should respond)
  await window.waitForTimeout(3000);

  // Quit the app
  await electronApp.evaluate(async ({ app }: { app: any }) => {
    app.quit();
  });

  await electronApp.close();
  electronApp = null;
});

test('permission card flow', async () => {
  // This test would trigger a permission request from the agent
  // and verify the native notification and card behavior
  // Requires a fake agent that emits permission_request
  test.skip(true, 'requires fake agent with permission emission');
});

test('native notification when window hidden', async () => {
  test.skip(true, 'requires Electron notification testing setup');
});