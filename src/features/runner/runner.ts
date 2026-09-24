import path from 'path';
import fs from 'fs';
import type { Page, BrowserContext } from 'playwright';
import {
  type VisualScenario,
  VIEWPORT_PRESETS,
  type AgentLensPlugin
} from '../../shared/api/dsl';
import { CaptureEngine } from '../capture/capture';
import { VisualReporter } from '../reporter/reporter';
import { ConsoleTracker } from '../console-tracker/consoleTracker';
import { PreviewDriver } from '../../shared/drivers/previewDriver';
import { ProcessManager } from '../../shared/lib/processManager';
import { PluginManager } from '../../shared/lib/pluginLoader';
import { createNavigator } from './lib/navigation';
import { syncLatestArtifacts } from './lib/artifactsSync';
import { buildTestContext } from './lib/contextBuilder';

export interface RunOptions {
  scenario: VisualScenario;
  targetMode?: 'desktop' | 'preview' | string;
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
  plugins?: (string | AgentLensPlugin)[];
}

export interface RunResult {
  scenarioId: string;
  targetMode: 'desktop' | 'preview' | string;
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
  const currentViewport = { width: defaultViewport.width, height: defaultViewport.height };

  let previewDriver: PreviewDriver | null = null;
  let processManager: ProcessManager | null = null;
  let customDriverStop: (() => Promise<void>) | null = null;

  // Initialize and load plugins
  const pluginManager = new PluginManager();
  const pluginSpecs = [...(options.plugins || []), ...(scenario.plugins || [])];
  if (pluginSpecs.length > 0) {
    await pluginManager.loadAll(pluginSpecs);
  }

  const hookContext = {
    scenario,
    targetMode,
    artifactsDir: scenarioArtifactsDir,
    cliOptions: options as unknown as Record<string, unknown>,
    state: new Map<string, unknown>()
  };

  try {
    let page: Page;
    let context: BrowserContext;

    console.log(`\n========================================`);
    console.log(`🚀 Starting Visual Test: ${scenario.title}`);
    console.log(`🎯 Mode: ${targetMode.toUpperCase()}`);
    console.log(`📁 Artifacts: ${scenarioArtifactsDir}`);
    console.log(`========================================\n`);

    // 1. Optional dev-server/process management
    if (options.startCommand) {
      processManager = new ProcessManager();
      await processManager.start(options.startCommand, { cwd: options.startCwd });
      const waitTarget = options.url || 'http://localhost:5173';
      await processManager.waitForUrl(waitTarget);
    }

    // 2. Run plugin setup hooks
    await pluginManager.runSetup(hookContext);

    if (typeof scenario.setup === 'function') {
      console.log(`🔧 [Scenario Setup] Executing setup hook...`);
      await scenario.setup();
    }

    // 3. Driver Session Launch (Microkernel Pattern)
    const customSession = await pluginManager.launchSession(
      { currentViewport, headed: options.headed },
      hookContext
    );

    if (customSession) {
      page = customSession.page;
      context = customSession.context;
      if (customSession.stop) {
        customDriverStop = customSession.stop;
      }
    } else if (targetMode === 'desktop') {
      throw new Error(
        `[AgentLens] Target mode is 'desktop', but no desktop plugin is registered. ` +
        `Please add --plugin=desktop-webview2 to your command or configuration.`
      );
    } else {
      // Standard Core Preview Driver (Chromium)
      previewDriver = new PreviewDriver({
        wwwrootDir: options.wwwrootDir,
        url: options.url,
        headed: options.headed
      });

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

    // 4. Run plugin browser/context lifecycle hooks
    await pluginManager.runOnContextCreated(context, hookContext);
    await pluginManager.runOnPageCreated(page, context, hookContext);

    // 5. Attach console error interception
    consoleTracker.attach(page);
    console.log(`🔍 [Console Tracker] Attached — errors and warnings will be captured\n`);

    // 6. Navigation and Context Setup
    const doNavigate = createNavigator(page, previewDriver?.baseUrl, options.url);

    if (scenario.route) {
      console.log(`🧭 [Runner] Navigating to initial route: ${scenario.route}`);
      await doNavigate(scenario.route);
    }

    const { ctx } = buildTestContext({
      page,
      context,
      targetMode,
      initialViewport: currentViewport,
      captureEngine,
      consoleTracker,
      previewDriver,
      doNavigate
    });

    // 7. Allow plugins to extend TestContext (e.g. mock-ipc, live-controller)
    await pluginManager.extendContext(ctx, page, hookContext);

    // 8. Execute the scenario body
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

    // 9. Generate Report & Run AfterRun Hooks
    const reportData = {
      scenario,
      snapshots,
      consoleErrors,
      consoleWarnings,
      outputDir: scenarioArtifactsDir,
      targetMode,
      durationMs,
      customSections: []
    };

    await pluginManager.runOnAfterRun(reportData, hookContext);
    const reportPath = VisualReporter.generateReport(reportData);
    const latestReport = syncLatestArtifacts(artifactsRoot, scenarioArtifactsDir, reportPath, snapshots);

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

    const reportData = {
      scenario,
      snapshots,
      consoleErrors,
      consoleWarnings,
      outputDir: scenarioArtifactsDir,
      targetMode,
      durationMs
    };

    const reportPath = VisualReporter.generateReport(reportData);
    syncLatestArtifacts(artifactsRoot, scenarioArtifactsDir, reportPath, snapshots);

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
    // 10. Guaranteed teardown sequence
    await pluginManager.runTeardown(hookContext);

    if (typeof scenario.teardown === 'function') {
      try {
        console.log(`🧹 [Scenario Teardown] Executing teardown hook...`);
        await scenario.teardown();
      } catch (teardownErr: any) {
        console.error(`⚠️ [Scenario Teardown] Error during teardown:`, teardownErr.message);
      }
    }

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

    if (!options.detach) {
      if (customDriverStop) await customDriverStop();
      if (previewDriver) await previewDriver.stop();
      if (processManager) await processManager.stop();
    } else {
      console.log('🔗 [Runner] Detach mode active, leaving browser/app open.');
    }
  }
}