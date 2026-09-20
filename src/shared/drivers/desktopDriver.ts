import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from '../lib/playwrightLoader';

export interface DesktopDriverOptions {
  port?: number;
  executablePath?: string;
  autoLaunch?: boolean;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export class DesktopDriver {
  private port: number;
  private executablePath?: string;
  private autoLaunch: boolean;
  private args: string[];
  private env: Record<string, string>;
  private cwd?: string;

  private childProcess: ChildProcess | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private processStderr: string = '';
  private processExited: boolean = false;
  private exitCode: number | null = null;

  constructor(options?: DesktopDriverOptions) {
    this.port = options?.port || 9222;
    this.autoLaunch = options?.autoLaunch ?? true;
    this.executablePath = options?.executablePath;
    this.args = options?.args || [];
    this.env = options?.env || {};
    this.cwd = options?.cwd;
  }

  private async isPortAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/json/version`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(800, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private async waitForPort(timeoutMs: number = 25000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (this.processExited) {
        throw new Error(
          `[DesktopDriver] Process terminated prematurely with exit code ${this.exitCode}.\nStderr: ${this.processStderr.trim() || '(none)'}`
        );
      }

      if (await this.isPortAvailable()) {
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error(
      `Timeout waiting for WebView2/Chromium CDP port ${this.port}. Last stderr:\n${this.processStderr.trim() || '(no stderr output)'}`
    );
  }

  public async start(initialViewport = { width: 1200, height: 800 }): Promise<{ page: Page; context: BrowserContext; browser: Browser }> {
    const alreadyRunning = await this.isPortAvailable();

    if (!alreadyRunning) {
      if (!this.autoLaunch) {
        throw new Error(
          `App is not running on port ${this.port} and autoLaunch is false. Start app with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=${this.port}`
        );
      }

      if (!this.executablePath) {
        throw new Error(
          `[DesktopDriver] No executablePath provided and nothing is running on port ${this.port}. Specify --exe=<path> in CLI or executablePath in config.`
        );
      }

      const resolvedExe = path.resolve(process.cwd(), this.executablePath);
      if (!fs.existsSync(resolvedExe)) {
        throw new Error(
          `[DesktopDriver] Desktop executable not found at: ${resolvedExe}. Please build your native project first.`
        );
      }

      console.log(`[DesktopDriver] Launching: ${resolvedExe}`);
      const mergedEnv = {
        ...process.env,
        ...this.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${this.port}`
      };

      this.processStderr = '';
      this.processExited = false;
      this.exitCode = null;

      this.childProcess = spawn(resolvedExe, this.args, {
        env: mergedEnv,
        cwd: this.cwd || path.dirname(resolvedExe),
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: false
      });

      this.childProcess.stderr?.on('data', (chunk) => {
        this.processStderr += chunk.toString();
      });

      this.childProcess.on('exit', (code) => {
        this.processExited = true;
        this.exitCode = code;
      });

      this.childProcess.on('error', (err) => {
        console.error('[DesktopDriver] Failed to spawn process:', err);
      });

      console.log(`[DesktopDriver] Waiting for CDP debugging port on ${this.port}...`);
      await this.waitForPort();
    } else {
      console.log(`[DesktopDriver] Attached to already running process on port ${this.port}`);
    }

    console.log(`[DesktopDriver] Connecting Playwright CDP to http://127.0.0.1:${this.port}...`);
    this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${this.port}`);
    
    const contexts = this.browser.contexts();
    this.context = contexts[0] || (await this.browser.newContext());

    const pages = this.context.pages();
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.context.waitForEvent('page', { timeout: 10000 });
    }

    if (initialViewport) {
      await this.page.setViewportSize(initialViewport).catch(() => {});
    }

    return { page: this.page, context: this.context, browser: this.browser };
  }

  public async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }

    if (this.childProcess && !this.childProcess.killed) {
      console.log('[DesktopDriver] Terminating spawned desktop process...');
      try {
        if (process.platform === 'win32' && this.childProcess.pid) {
          spawn('taskkill', ['/pid', String(this.childProcess.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          this.childProcess.kill('SIGTERM');
        }
      } catch {
        // ignore
      }
      this.childProcess = null;
    }
  }
}
