import fs from 'fs';
import path from 'path';
import { chromium } from '../../shared/lib/playwrightLoader';

const logDir = path.join(process.cwd(), '.agent-lens');
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {}
}
const logFile = path.join(logDir, 'live-daemon.log');

function log(msg: string): void {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason}`);
});

async function runDaemon(): Promise<void> {
  const url = process.argv[2] || 'http://localhost:5173';
  const port = parseInt(process.argv[3] || '9223', 10);
  const headed = process.argv[4] === 'true';

  log(`Daemon starting: url=${url}, port=${port}, headed=${headed}`);

  try {
    const browser = await chromium.launch({
      headless: !headed,
      args: [`--remote-debugging-port=${port}`, '--no-sandbox']
    });
    log(`Browser launched on port ${port}`);

    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((e: Error) => {
      log(`Page goto warning: ${e.message}`);
    });
    log(`Page ready: ${url}`);

    // Keep process alive indefinitely until killed by stopLiveSession()
    setInterval(() => {}, 60_000);
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    log(`FATAL ERROR: ${e.stack || e.message}`);
    process.exit(1);
  }
}

runDaemon();
