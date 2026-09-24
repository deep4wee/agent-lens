import path from 'path';
import type { Page } from 'playwright';
import {
  connectToLiveSession,
  saveLiveSession,
  stopLiveSession,
  getLiveArtifactsDir
} from './session';
import { chromium } from '../../shared/lib/playwrightLoader';

export interface SnapLiveOptions {
  name?: string;
  fullPage?: boolean;
  selector?: string;
}

/**
 * Click at physical pixel coordinates on the page (for Vision AI models).
 */
export async function clickCoords(
  page: Page,
  x: number,
  y: number,
  options?: { button?: 'left' | 'right' | 'middle'; clickCount?: number }
): Promise<void> {
  console.log(`🖱️ [LiveController] Clicking coordinates: (${x}, ${y})`);
  await page.mouse.click(x, y, options);
  await page.waitForTimeout(200);
}

/**
 * Drag and drop from (fromX, fromY) to (toX, toY).
 */
export async function dragAndDrop(
  page: Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps = 10
): Promise<void> {
  console.log(`🖐️ [LiveController] Dragging from (${fromX}, ${fromY}) to (${toX}, ${toY}) in ${steps} steps`);
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/**
 * Scroll page by percentage (0 to 100).
 */
export async function scrollPercent(page: Page, percent: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, percent));
  console.log(`📜 [LiveController] Scrolling to ${clamped}% of page height`);
  await page.evaluate((pct) => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const targetY = (totalHeight * pct) / 100;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }, clamped);
  await page.waitForTimeout(300);
}

/**
 * Capture a live snapshot with optional fullPage (--full) support.
 */
export async function snapLive(page: Page, options?: SnapLiveOptions): Promise<string> {
  const artifactsDir = getLiveArtifactsDir();
  const fileName = options?.name ? `${options.name}.png` : 'current.png';
  const filePath = path.join(artifactsDir, fileName);

  if (options?.selector) {
    const el = await page.waitForSelector(options.selector, { timeout: 5000 });
    await el.screenshot({ path: filePath });
  } else {
    await page.screenshot({ path: filePath, fullPage: options?.fullPage ?? false });
  }

  console.log(`📸 [LiveController] Snapshot saved: ${filePath}${options?.fullPage ? ' (Full Page)' : ''}`);
  return filePath;
}

/**
 * Handle CLI commands: live start, click, type, snap, stop
 */
export async function handleLiveCli(argv: string[]): Promise<boolean> {
  const action = argv[0]?.toLowerCase();

  switch (action) {
    case 'start': {
      const urlArg = argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:5173';
      const portArg = parseInt(argv.find((a) => a.startsWith('--port='))?.split('=')[1] || '9223', 10);
      const isHeaded = argv.includes('--headed');

      console.log(`🚀 [Live] Starting background browser for ${urlArg} on CDP port ${portArg}...`);

      const browser = await chromium.launch({
        headless: !isHeaded,
        args: [`--remote-debugging-port=${portArg}`, '--no-sandbox']
      });

      const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
      const page = await context.newPage();
      await page.goto(urlArg, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      saveLiveSession({
        port: portArg,
        url: urlArg,
        startedAt: new Date().toISOString()
      });

      await snapLive(page, { name: 'current' });
      console.log(`✅ [Live] Session active! You can now send live commands:\n`);
      console.log(`   npx agent-lens live click 450 120`);
      console.log(`   npx agent-lens live type "input" "hello"`);
      console.log(`   npx agent-lens live snap --full`);
      console.log(`   npx agent-lens live stop\n`);
      return true;
    }

    case 'click': {
      const { page, browser } = await connectToLiveSession();
      const firstArg = argv[1];
      const secondArg = argv[2];

      const x = parseInt(firstArg, 10);
      const y = parseInt(secondArg, 10);

      if (!isNaN(x) && !isNaN(y)) {
        await clickCoords(page, x, y);
      } else if (firstArg) {
        console.log(`🖱️ [Live] Clicking selector: "${firstArg}"`);
        await page.click(firstArg);
      } else {
        console.error(`❌ Usage: npx agent-lens live click <x> <y> OR npx agent-lens live click <selector>`);
        await browser.close();
        return false;
      }

      await snapLive(page, { name: 'current' });
      return true;
    }

    case 'type': {
      const { page, browser } = await connectToLiveSession();
      const selector = argv[1];
      const text = argv[2];

      if (!selector || text === undefined) {
        console.error(`❌ Usage: npx agent-lens live type <selector> <text>`);
        await browser.close();
        return false;
      }

      console.log(`⌨️ [Live] Typing into "${selector}": "${text}"`);
      await page.fill(selector, text);
      await snapLive(page, { name: 'current' });
      return true;
    }

    case 'snap': {
      const { page } = await connectToLiveSession();
      const isFull = argv.includes('--full');
      const nameArg = argv.find((a) => !a.startsWith('--') && a !== 'snap');

      await snapLive(page, { name: nameArg || 'current', fullPage: isFull });
      return true;
    }

    case 'stop': {
      return await stopLiveSession();
    }

    default: {
      console.log(`
ℹ️ AgentLens Live Controller:
  npx agent-lens live start --url=<url>   Start background live session
  npx agent-lens live click <x> <y>       Click at pixel coordinates
  npx agent-lens live click <selector>    Click CSS selector
  npx agent-lens live type <sel> <text>   Fill input field
  npx agent-lens live snap [name] [--full] Capture current or full-page screenshot
  npx agent-lens live stop                Close live browser and finish
      `);
      return true;
    }
  }
}
