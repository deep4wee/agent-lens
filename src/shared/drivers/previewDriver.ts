import http from 'http';
import fs from 'fs';
import path from 'path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from '../lib/playwrightLoader';
import { MockIpcRegistry, generateMockIpcScript } from '../../features/mock-ipc/mockIpc';
import { resolveWwwrootDir } from '../lib/config';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

export interface PreviewDriverOptions {
  wwwrootDir?: string;
  headed?: boolean;
  url?: string;
}

export class PreviewDriver {
  private server: http.Server | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private serverPort: number = 0;
  private options: PreviewDriverOptions;
  private _baseUrl: string = '';

  public readonly mockRegistry: MockIpcRegistry;

  constructor(options?: PreviewDriverOptions) {
    this.options = options || {};
    if (!this.options.url) {
      this.options.wwwrootDir = resolveWwwrootDir(this.options.wwwrootDir);
    }
    this.mockRegistry = new MockIpcRegistry();
  }

  public get baseUrl(): string {
    return this._baseUrl;
  }

  public async start(initialViewport = { width: 1200, height: 800 }): Promise<{ page: Page; context: BrowserContext; browser: Browser }> {
    let targetUrl = this.options.url;

    if (!targetUrl) {
      if (!fs.existsSync(this.options.wwwrootDir!)) {
        throw new Error(`Directory not found at: ${this.options.wwwrootDir}. Please build your frontend project first or pass --url=<url>.`);
      }

      await new Promise<void>((resolve, reject) => {
        this.server = http.createServer((req, res) => {
          let reqUrl = req.url?.split('?')[0] || '/';
          if (reqUrl === '/') reqUrl = '/index.html';

          let safePath = path.normalize(path.join(this.options.wwwrootDir!, reqUrl));
          if (!safePath.startsWith(this.options.wwwrootDir!)) {
            res.writeHead(403);
            return res.end('Forbidden');
          }

          if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
            // SPA fallback to index.html
            safePath = path.join(this.options.wwwrootDir!, 'index.html');
          }

          const ext = path.extname(safePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';

          try {
            const content = fs.readFileSync(safePath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
          } catch (e: any) {
            res.writeHead(500);
            res.end(`Server error: ${e.message}`);
          }
        });

        this.server.listen(0, '127.0.0.1', () => {
          const addr = this.server?.address();
          if (typeof addr === 'object' && addr?.port) {
            this.serverPort = addr.port;
            this._baseUrl = `http://127.0.0.1:${this.serverPort}`;
            resolve();
          } else {
            reject(new Error('Failed to acquire port for static preview server'));
          }
        });
      });

      targetUrl = `${this._baseUrl}/index.html`;
    } else {
      this._baseUrl = targetUrl;
      console.log(`🌐 [PreviewDriver] Connecting directly to live URL: ${targetUrl}`);
    }

    this.browser = await chromium.launch({
      headless: !this.options.headed,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: initialViewport,
      deviceScaleFactor: 1
    });

    if (this.mockRegistry.size > 0) {
      const mockScript = generateMockIpcScript(this.mockRegistry);
      await this.context.addInitScript(mockScript);
    }

    this.page = await this.context.newPage();
    await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    return { page: this.page, context: this.context, browser: this.browser };
  }

  public async updateMockIpc(action: string, data: any, options?: { type?: string; delayMs?: number }): Promise<void> {
    if (!this.page) {
      throw new Error('PreviewDriver not started. Call start() first.');
    }

    this.mockRegistry.set(action, data, options as any);

    await this.page.evaluate(
      ({ action, mock }) => {
        if (!(window as any).__visualRunnerMocks) {
          (window as any).__visualRunnerMocks = {};
        }
        (window as any).__visualRunnerMocks[action] = mock;
      },
      {
        action,
        mock: {
          data,
          type: options?.type ?? 'SUCCESS',
          delayMs: options?.delayMs ?? 20
        }
      }
    );
  }

  public async stop(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }
  }
}
