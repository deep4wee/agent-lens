import type { Page } from 'playwright';

export type NavigateFunction = (route: string) => Promise<void>;

/**
 * Creates an intelligent route navigator supporting full URLs, hash routes,
 * base-relative paths, and SPA hash fallbacks.
 */
export function createNavigator(page: Page, baseUrl?: string, targetUrl?: string): NavigateFunction {
  return async (route: string): Promise<void> => {
    // 1. Direct absolute URLs
    if (route.startsWith('http://') || route.startsWith('https://')) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      return;
    }

    // 2. Hash-based routing (e.g. #/settings)
    if (route.startsWith('#')) {
      await page.evaluate((r) => { window.location.hash = r; }, route);
      await page.waitForTimeout(300);
      return;
    }

    // 3. Base URL resolution
    if (baseUrl && targetUrl) {
      try {
        const fullUrl = new URL(route, baseUrl).toString();
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);
        return;
      } catch {
        // Fall back to hash navigation on invalid URL format
      }
    }

    // 4. Default client-side SPA fallback
    const routePath = route.startsWith('/') ? route : `/${route}`;
    await page.evaluate((r) => {
      if (window.location.hash !== undefined) {
        window.location.hash = r;
      }
    }, routePath);
    await page.waitForTimeout(300);
  };
}
