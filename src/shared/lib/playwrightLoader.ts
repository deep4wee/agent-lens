import { chromium as baseChromium, type ChromiumBrowser, type BrowserType } from 'playwright';

/**
 * Safe Playwright Chromium loader that wraps browser initialization with helpful diagnostic messages.
 */
export const chromium: BrowserType<ChromiumBrowser> = new Proxy(baseChromium, {
  get(target, prop, receiver) {
    if (prop === 'launch') {
      return async (...args: Parameters<typeof baseChromium.launch>) => {
        try {
          return await target.launch(...args);
        } catch (err: any) {
          if (
            err.message?.includes("Executable doesn't exist") ||
            err.message?.includes('playwright install') ||
            err.message?.includes('browser has not been downloaded')
          ) {
            console.error("\n❌ [AgentLens] Playwright Chromium browser binary is missing!");
            console.error("👉 Please install it by running: npx playwright install chromium\n");
          }
          throw err;
        }
      };
    }
    const val = Reflect.get(target, prop, receiver);
    return typeof val === 'function' ? val.bind(target) : val;
  }
});