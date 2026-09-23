import path from 'path';
import fs from 'fs';
import type { Page, BrowserContext } from 'playwright';
import {
  type VisualScenario,
  type TestContext,
  type ViewportPreset,
  VIEWPORT_PRESETS,
  type CaptureOptions,
  type CaptureBurstOptions
} from '../../shared/api/dsl';
import { CaptureEngine } from '../capture/capture';
import { VisualReporter } from '../reporter/reporter';
import { ConsoleTracker } from '../console-tracker/consoleTracker';
import { DesktopDriver } from '../../shared/drivers/desktopDriver';
import { PreviewDriver } from '../../shared/drivers/previewDriver';
import { ProcessManager } from '../../shared/lib/processManager';

export interface RunOptions {
  scenario: VisualScenario;
  targetMode?: 'desktop' | 'preview';
  artifactsRoot?: string;
  autoLaunchDesktop?: boolean;
  port?: number;
  wwwrootDir?: string;
  executablePath?: string;
  desktopArgs?: string[];
  desktopEnv?: Record<string, string>;
  cleanPaths?: string[];
  url?: string;
  startCommand?: string;
  startCwd?: string;
  cleanArtifacts?: boolean;
  headed?: boolean;
  detach?: boolean;
  globalMocks?: any[];
}

export interface RunResult {
  scenarioId: string;
  targetMode: 'desktop' | 'preview';
  success: boolean;
  totalSnapshots: number;
  consoleErrors: number;
  consoleWarnings: number;
  reportPath: string;
  artifactsDir: string;
  error?: string;
}

export async function runVisualScenario(options: RunOptions): Promise<RunResult> {
  const { scenario } = options;
  const targetMode = options.targetMode || 'preview';
  const startTime = Date.now();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const artifactsRoot = options.artifactsRoot || path.resolve(process.cwd(), 'artifacts');

  if (options.cleanArtifacts && fs.existsSync(artifactsRoot)) {
    console.log(`🧹 [Clean Artifacts] Purging previous artifact runs in ${artifactsRoot}...`);
    const entries = fs.readdirSync(artifactsRoot, { withFileTypes: true });
    for (const entry of entries) {
      fs.rmSync(path.join(artifactsRoot, entry.name), { recursive: true, force: true });
    }
  }

  const scenarioArtifactsDir = path.join(artifactsRoot, `${scenario.id}_${timestamp}`);
  
  if (!fs.existsSync(scenarioArtifactsDir)) {
    fs.mkdirSync(scenarioArtifactsDir, { recursive: true });
  }

  const captureEngine = new CaptureEngine(scenarioArtifactsDir);
  const consoleTracker = new ConsoleTracker();
  const defaultViewport = scenario.viewports?.[0] || VIEWPORT_PRESETS.DEFAULT;
  let currentViewport = { width: defaultViewport.width, height: defaultViewport.height };

  let desktopDriver: DesktopDriver | null = null;
  let previewDriver: PreviewDriver | null = null;
  let processManager: ProcessManager | null = null;

  try {
    let page: Page;
    let context: BrowserContext;

    console.log(`\n========================================`);
    console.log(`🚀 Starting Visual Test: ${scenario.title}`);
    console.log(`🎯 Mode: ${targetMode.toUpperCase()}`);
    console.log(`📁 Artifacts: ${scenarioArtifactsDir}`);
    console.log(`========================================\n`);

    if (options.startCommand) {
      processManager = new ProcessManager();
      await processManager.start(options.startCommand, { cwd: options.startCwd });
      const waitTarget = options.url || 'http://localhost:5173';
      await processManager.waitForUrl(waitTarget);
    }

    if (typeof scenario.setup === 'function') {
      console.log(`🔧 [Scenario Setup] Executing setup hook...`);
      await scenario.setup();
    }

    if (targetMode === 'desktop') {
      desktopDriver = new DesktopDriver({
        port: options.port || 9222,
        autoLaunch: options.autoLaunchDesktop ?? true,
        executablePath: options.executablePath,
        args: options.desktopArgs,
        env: options.desktopEnv
      });
      const res = await desktopDriver.start(currentViewport);
      page = res.page;
      context = res.context;
    } else {
      previewDriver = new PreviewDriver({
        wwwrootDir: options.wwwrootDir,
        url: options.url,
        headed: options.headed
      });

            // Apply declarative mockIpc from scenario and global mocks before start
      const mergedMocks = [...(options.globalMocks || []), ...(scenario.mockIpc || [])];
      if (mergedMocks.length > 0) {
        console.log(`📦 [Mock IPC] Applying ${mergedMocks.length} mocks`);
        previewDriver.mockRegistry.setBatch(mergedMocks);
      }

      if (scenario.mockRoutes && scenario.mockRoutes.length > 0) {
        console.log(`🌐 [Mock Network] Queuing ${scenario.mockRoutes.length} route mock(s)`);
        await previewDriver.setupRouteMocks(scenario.mockRoutes);
      }

      const res = await previewDriver.start(currentViewport);
      page = res.page;
      context = res.context;

      if (scenario.mockRoutes && scenario.mockRoutes.length > 0) {
        await previewDriver.setupRouteMocks(scenario.mockRoutes);
      }
    }
        

    // Attach console error interception
    consoleTracker.attach(page);
    console.log(`🔍 [Console Tracker] Attached — errors and warnings will be captured\n`);

    // Internal navigation function supporting live URLs and hash routing
    const doNavigate = async (route: string) => {
      if (route.startsWith('http://') || route.startsWith('https://')) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);
        return;
      }
      if (route.startsWith('#')) {
        await page.evaluate((r) => { window.location.hash = r; }, route);
        await page.waitForTimeout(300);
        return;
      }
      if (previewDriver?.baseUrl && options.url) {
        try {
          const fullUrl = new URL(route, previewDriver.baseUrl).toString();
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(300);
          return;
        } catch {
          // fallback to hash
        }
      }
      const routePath = route.startsWith('/') ? route : `/${route}`;
      await page.evaluate((r) => {
        if (window.location.hash !== undefined) {
          window.location.hash = r;
        }
      }, routePath);
      await page.waitForTimeout(300);
    };

    if (scenario.route) {
      console.log(`[Runner] Navigating to route: ${scenario.route}`);
      await doNavigate(scenario.route);
    }

    const ctx: TestContext = {
      page,
      context,
      targetMode,
      currentViewport,


      capture: async (name: string, opts?: CaptureOptions) => {
        console.log(`📸 [Snapshot] ${name} (${currentViewport.width}x${currentViewport.height})`);
        return await captureEngine.takeSnapshot(page, name, currentViewport, opts);
      },

      captureBurst: async (name: string, opts: CaptureBurstOptions) => {
        console.log(`🎬 [Burst] ${name} (duration: ${opts.durationMs}ms, interval: ${opts.intervalMs ?? 80}ms)`);
        return await captureEngine.takeBurst(page, name, currentViewport, opts);
      },


      navigate: async (route: string) => {
        console.log(`🧭 [Navigate] ${route}`);
        await doNavigate(route);
      },

      // ─── Viewport ───

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
          boundingBox = await page.evaluate(() => {
            return {
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight
            };
          });
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


      wait: async (ms: number) => {
        await page.waitForTimeout(ms);
      },

      waitForSelector: async (selector: string, timeoutMs = 5000) => {
        await page.waitForSelector(selector, { timeout: timeoutMs });
      },


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
        await page.evaluate(({ sel, dY }) => {
          const el = document.querySelector(sel);
          if (el) {
            el.scrollTop += dY;
          } else {
            window.scrollBy(0, dY);
          }
        }, { sel: selector, dY: deltaY });
        await page.waitForTimeout(100);
      },


      log: (msg: string) => {
        console.log(`ℹ️ [Scenario] ${msg}`);
      },

      // ─── Mock IPC ───

            setMockIpc: async (action: string, data: any, mockOptions?) => {
        if (targetMode === 'desktop') {
          console.log(`⚠️ [Mock IPC] setMockIpc ignored in desktop mode (real backend handles IPC)`);
          return;
        }
        if (!previewDriver) {
          console.log(`⚠️ [Mock IPC] PreviewDriver not available`);
          return;
        }
        console.log(`📦 [Mock IPC] Set ${action} -> ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 80)}...`);
        await previewDriver.updateMockIpc(action, data, mockOptions);
      },

      setMockRoute: async (url: string, body: any, routeOptions?) => {
        if (targetMode === 'desktop') {
          console.log(`⚠️ [Mock Route] setMockRoute ignored in desktop mode`);
          return;
        }
        if (!previewDriver) {
          console.log(`⚠️ [Mock Route] PreviewDriver not available`);
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


      getConsoleErrors: () => consoleTracker.getErrors(),
        
      getConsoleWarnings: () => consoleTracker.getWarnings(),
      hasConsoleErrors: () => consoleTracker.hasErrors,

      // ─── DOM Assertions ───

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

    await scenario.run(ctx);

    const durationMs = Date.now() - startTime;
    const snapshots = captureEngine.getSnapshots();
    const consoleErrors = consoleTracker.getErrors();
    const consoleWarnings = consoleTracker.getWarnings();

    if (consoleErrors.length > 0) {
      console.log(`\n🔴 Console Errors: ${consoleErrors.length}`);
      consoleErrors.forEach((err, i) => console.log(`   ${i + 1}. ${err.text.slice(0, 120)}`));
    }
    if (consoleWarnings.length > 0) {
      console.log(`\n🟡 Console Warnings: ${consoleWarnings.length}`);
    }

    const reportPath = VisualReporter.generateReport({
      scenario,
      snapshots,
      consoleErrors,
      consoleWarnings,
      outputDir: scenarioArtifactsDir,
      targetMode,
      durationMs
    });

    const syncLatest = (repPath: string, snaps: any[]) => {
      try {
        const latestDir = path.join(artifactsRoot, 'latest');
        if (fs.existsSync(latestDir)) {
          fs.rmSync(latestDir, { recursive: true, force: true });
        }
        fs.mkdirSync(latestDir, { recursive: true });
        fs.copyFileSync(repPath, path.join(latestDir, 'report.md'));
        const manifestSrc = path.join(scenarioArtifactsDir, 'manifest.json');
        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, path.join(latestDir, 'manifest.json'));
        }
        for (const snap of snaps) {
          if (snap.filePath && fs.existsSync(snap.filePath)) {
            fs.copyFileSync(snap.filePath, path.join(latestDir, snap.fileName));
          }
        }
        return path.join(latestDir, 'report.md');
      } catch {
        return undefined;
      }
    };

    const latestReport = syncLatest(reportPath, snapshots);

    console.log(`\n✅ Visual Test Completed Successfully!`);
    console.log(`📊 Captured Snapshots: ${snapshots.length}`);
    console.log(`🔴 Console Errors: ${consoleErrors.length}`);
    console.log(`🟡 Console Warnings: ${consoleWarnings.length}`);
    console.log(`📄 Markdown Report: ${reportPath}`);
    if (latestReport) {
      console.log(`📌 Latest Report: ${latestReport}`);
    }

    return {
      scenarioId: scenario.id,
      targetMode,
      success: true,
      totalSnapshots: snapshots.length,
      consoleErrors: consoleErrors.length,
      consoleWarnings: consoleWarnings.length,
      reportPath,
      artifactsDir: scenarioArtifactsDir
    };
  } catch (err: any) {
    console.error(`\n❌ Visual Test Failed: ${err.message}`);
    const durationMs = Date.now() - startTime;
    const snapshots = captureEngine.getSnapshots();
    const consoleErrors = consoleTracker.getErrors();
    const consoleWarnings = consoleTracker.getWarnings();

    const reportPath = VisualReporter.generateReport({
      scenario,
      snapshots,
      consoleErrors,
      consoleWarnings,
      outputDir: scenarioArtifactsDir,
      targetMode,
      durationMs
    });

    try {
      const latestDir = path.join(artifactsRoot, 'latest');
      if (fs.existsSync(latestDir)) {
        fs.rmSync(latestDir, { recursive: true, force: true });
      }
      fs.mkdirSync(latestDir, { recursive: true });
      fs.copyFileSync(reportPath, path.join(latestDir, 'report.md'));
    } catch {
      // ignore
    }

    return {
      scenarioId: scenario.id,
      targetMode,
      success: false,
      totalSnapshots: snapshots.length,
      consoleErrors: consoleErrors.length,
      consoleWarnings: consoleWarnings.length,
      reportPath,
      artifactsDir: scenarioArtifactsDir,
      error: err.message
    };
  } finally {
    // 1. Run scenario teardown hook (guaranteed cleanup)
    if (typeof scenario.teardown === 'function') {
      try {
        console.log(`🧹 [Scenario Teardown] Executing teardown hook...`);
        await scenario.teardown();
      } catch (teardownErr: any) {
        console.error(`⚠️ [Scenario Teardown] Error during teardown:`, teardownErr.message);
      }
    }

    // 2. Perform requested file and folder cleanups
    if (options.cleanPaths && options.cleanPaths.length > 0) {
      for (const cleanTarget of options.cleanPaths) {
        try {
          const resolvedCleanPath = path.resolve(process.cwd(), cleanTarget);
          if (fs.existsSync(resolvedCleanPath)) {
            console.log(`🧹 [Auto-Cleanup] Removing: ${resolvedCleanPath}`);
            fs.rmSync(resolvedCleanPath, { recursive: true, force: true });
          }
        } catch (cleanErr: any) {
          console.error(`⚠️ [Auto-Cleanup] Failed to remove ${cleanTarget}:`, cleanErr.message);
        }
      }
    }

    // 3. Stop running drivers unless detached
    if (!options.detach) {
      if (desktopDriver) await desktopDriver.stop();
      if (previewDriver) await previewDriver.stop();
      if (processManager) await processManager.stop();
    } else {
      console.log('🔗 [Runner] Detach mode active, leaving browser/app open.');
    }
  }
}
