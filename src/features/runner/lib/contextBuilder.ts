import type { Page, BrowserContext } from 'playwright';
import type {
  TestContext,
  ViewportPreset,
  CaptureOptions,
  CaptureBurstOptions,
  MockRouteEntry
} from '../../../shared/api/dsl';
import type { CaptureEngine } from '../../capture/capture';
import type { ConsoleTracker } from '../../console-tracker/consoleTracker';
import type { PreviewDriver } from '../../../shared/drivers/previewDriver';
import type { NavigateFunction } from './navigation';

export interface ContextBuilderOptions {
  page: Page;
  context: BrowserContext;
  targetMode: 'desktop' | 'preview' | string;
  initialViewport: { width: number; height: number };
  captureEngine: CaptureEngine;
  consoleTracker: ConsoleTracker;
  previewDriver: PreviewDriver | null;
  doNavigate: NavigateFunction;
}

export function buildTestContext(options: ContextBuilderOptions): {
  ctx: TestContext;
  getCurrentViewport: () => { width: number; height: number };
} {
  const {
    page,
    context,
    targetMode,
    initialViewport,
    captureEngine,
    consoleTracker,
    previewDriver,
    doNavigate
  } = options;

  let currentViewport = { ...initialViewport };

  const ctx: TestContext = {
    page,
    context,
    targetMode: targetMode as 'desktop' | 'preview',
    currentViewport,

    // --- Snapshots ---
    capture: async (name: string, opts?: CaptureOptions) => {
      console.log(`📸 [Snapshot] ${name} (${currentViewport.width}x${currentViewport.height})`);
      return await captureEngine.takeSnapshot(page, name, currentViewport, opts);
    },

    captureBurst: async (name: string, opts: CaptureBurstOptions) => {
      console.log(`🎬 [Burst] ${name} (duration: ${opts.durationMs}ms, interval: ${opts.intervalMs ?? 80}ms)`);
      return await captureEngine.takeBurst(page, name, currentViewport, opts);
    },

    // --- Navigation ---
    navigate: async (route: string) => {
      console.log(`🧭 [Navigate] ${route}`);
      await doNavigate(route);
    },

    // --- Viewport Management ---
    resize: async (width: number, height: number) => {
      console.log(`📐 [Resize] ${width}x${height}`);
      currentViewport = { width, height };
      ctx.currentViewport = currentViewport;
      await page.setViewportSize(currentViewport);
      await page.waitForTimeout(200);
    },

    setPreset: async (preset: ViewportPreset) => {
      console.log(`📐 [Preset] ${preset.name} (${preset.width}x${preset.height})`);
      await ctx.resize(preset.width, preset.height);
    },

    resizeToFit: async (selector?: string, padding = 0) => {
      let boundingBox;
      if (selector) {
        const el = await page.$(selector);
        if (el) {
          boundingBox = await el.boundingBox();
        }
      } else {
        boundingBox = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight
        }));
      }

      if (boundingBox) {
        const newWidth = Math.ceil(boundingBox.width) + padding * 2;
        const newHeight = Math.ceil(boundingBox.height) + padding * 2;
        console.log(`📐 [ResizeToFit] ${selector || 'body'} -> ${newWidth}x${newHeight}`);
        await ctx.resize(newWidth, newHeight);
      } else {
        console.log(`⚠️ [ResizeToFit] Element ${selector} not found or has no bounding box.`);
      }
    },

    // --- Waiting & DOM Observation ---
    wait: async (ms: number) => {
      await page.waitForTimeout(ms);
    },

    waitForSelector: async (selector: string, timeoutMs = 5000) => {
      await page.waitForSelector(selector, { timeout: timeoutMs });
    },

    // --- Interaction ---
    click: async (selector: string) => {
      console.log(`🖱️ [Click] ${selector}`);
      await page.click(selector);
    },

    rightClick: async (selector: string) => {
      console.log(`🖱️ [RightClick] ${selector}`);
      await page.click(selector, { button: 'right' });
    },

    type: async (selector: string, text: string) => {
      console.log(`⌨️ [Type] ${selector} -> "${text}"`);
      await page.fill(selector, text);
    },

    selectOption: async (selector: string, value: string) => {
      console.log(`✅ [Select] ${selector} -> "${value}"`);
      await page.selectOption(selector, value);
    },

    hover: async (selector: string) => {
      console.log(`👆 [Hover] ${selector}`);
      await page.hover(selector);
    },

    scroll: async (selector: string, deltaY: number) => {
      console.log(`📜 [Scroll] ${selector} by ${deltaY}px`);
      await page.evaluate(
        ({ sel, dY }) => {
          const el = document.querySelector(sel);
          if (el) {
            el.scrollTop += dY;
          } else {
            window.scrollBy(0, dY);
          }
        },
        { sel: selector, dY: deltaY }
      );
      await page.waitForTimeout(100);
    },

    // --- Logging ---
    log: (msg: string) => {
      console.log(`ℹ️ [Scenario] ${msg}`);
    },

    // --- Mock IPC (delegated or stubbed if plugin not loaded) ---
    setMockIpc: async (action: string, data: any, mockOptions?: any) => {
      console.log(`⚠️ [Mock IPC] setMockIpc called for "${action}". Ensure --plugin=mock-ipc is enabled.`);
    },

    // --- HTTP Route Mocking ---
    setMockRoute: async (
      url: string,
      body: any,
      routeOptions?: { method?: string; status?: number; delayMs?: number; headers?: Record<string, string> }
    ) => {
      if (!previewDriver) {
        console.log(`⚠️ [Mock Route] setMockRoute ignored (no preview driver running)`);
        return;
      }
      console.log(`🌐 [Mock Route] Intercepting ${routeOptions?.method || 'ALL'} ${url} -> ${routeOptions?.status ?? 200}`);
      await previewDriver.addRouteMock({
        url,
        body,
        method: routeOptions?.method,
        status: routeOptions?.status,
        delayMs: routeOptions?.delayMs,
        headers: routeOptions?.headers
      });
    },

    // --- Console Errors ---
    getConsoleErrors: () => consoleTracker.getErrors(),
    getConsoleWarnings: () => consoleTracker.getWarnings(),
    hasConsoleErrors: () => consoleTracker.hasErrors,

    // --- DOM Assertions ---
    readText: async (selector: string): Promise<string | null> => {
      const text = await page.textContent(selector);
      return text ? text.trim() : null;
    },

    getPageText: async (): Promise<string> => {
      return await page.evaluate(() => document.body.innerText || '');
    },

    isVisible: async (selector: string) => {
      try {
        const element = await page.$(selector);
        if (!element) return false;
        return await element.isVisible();
      } catch {
        return false;
      }
    },

    getElementCount: async (selector: string) => {
      const elements = await page.$$(selector);
      return elements.length;
    }
  };

  return {
    ctx,
    getCurrentViewport: () => currentViewport
  };
}
