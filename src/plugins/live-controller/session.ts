import fs from 'fs';
import path from 'path';
import type { Page, Browser, BrowserContext } from 'playwright';
import { chromium } from '../../shared/lib/playwrightLoader';
import treeKill from 'tree-kill';

export interface LiveSessionInfo {
  port: number;
  url: string;
  pid?: number;
  startedAt: string;
}

const SESSION_DIR = path.resolve(process.cwd(), '.agent-lens');
const SESSION_FILE = path.join(SESSION_DIR, 'live-session.json');
const LIVE_ARTIFACTS_DIR = path.resolve(process.cwd(), 'artifacts', 'live');

export function getSessionFile(): string {
  return SESSION_FILE;
}

export function getLiveArtifactsDir(): string {
  if (!fs.existsSync(LIVE_ARTIFACTS_DIR)) {
    fs.mkdirSync(LIVE_ARTIFACTS_DIR, { recursive: true });
  }
  return LIVE_ARTIFACTS_DIR;
}

export function readLiveSession(): LiveSessionInfo | null {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveLiveSession(info: LiveSessionInfo): void {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
  fs.writeFileSync(SESSION_FILE, JSON.stringify(info, null, 2), 'utf-8');
}

export function clearLiveSession(): void {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      fs.unlinkSync(SESSION_FILE);
    } catch {
      // ignore
    }
  }
}

/**
 * Connect to an already running Live Browser session over CDP.
 */
export async function connectToLiveSession(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const session = readLiveSession();
  if (!session) {
    throw new Error(
      `No active live session found. Start one with: npx agent-lens live start --url=http://localhost:5173`
    );
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${session.port}`);
  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  const pages = context.pages();
  const page = pages[0] || (await context.waitForEvent('page', { timeout: 5000 }));

  return { browser, context, page };
}

/**
 * Stop running live session and clean up process and session file.
 */
export async function stopLiveSession(): Promise<boolean> {
  const session = readLiveSession();
  if (!session) {
    console.log(`ℹ️ [Live] No active session to stop.`);
    return false;
  }

  try {
    const { browser } = await connectToLiveSession();
    await browser.close().catch(() => {});
  } catch {
    // browser might already be closed
  }

  if (session.pid) {
    await new Promise<void>((resolve) => {
      treeKill(session.pid!, 'SIGTERM', () => resolve());
    });
  }

  clearLiveSession();
  console.log(`🛑 [Live] Session stopped and cleaned up.`);
  return true;
}
