import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createJiti } from 'jiti';
import { loadConfig, resolveWwwrootDir } from '../shared/lib/config';
import { runVisualScenario } from '../features/runner';
import { runQuickSnap } from '../features/snap/snap';
import type { VisualScenario } from '../shared/api/dsl';
import { parseCliArgs } from './lib/argsParser';
import { printHelp } from './lib/help';
import { initScenarioTemplate } from './lib/templateInit';
import { findScenarios, resolveScenariosDirectory } from './lib/scenarioFinder';

import { handleLiveCli } from '../plugins/live-controller/actions';

const rawArgs = process.argv.slice(2);

if (rawArgs[0] === 'live') {
  handleLiveCli(rawArgs.slice(1))
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('❌ Live command failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
} else {
  const fileConfig = loadConfig();
  const { isSnapCommand, isInitCommand, options } = parseCliArgs(rawArgs, fileConfig);

  if (isInitCommand) {
    initScenarioTemplate();
    process.exit(0);
  }

if (options.help) {
  printHelp();
  process.exit(0);
}

async function main() {
  // 1. One-shot "snap" command execution
  if (isSnapCommand || (options.url && !options.scenario && !options.all)) {
    const snapSuccess = await runQuickSnap({
      url: options.url,
      start: options.start,
      startCwd: options.startCwd,
      selector: options.selector,
      viewports: options.viewports,
      waitMs: options.waitMs,
      name: options.name,
      clean: options.clean,
      cleanArtifacts: options.cleanArtifacts,
      headed: options.headed,
      detach: options.detach,
      outDir: options.outDir,
      mode: options.mode as any,
      exe: options.exe,
      port: options.port,
      plugins: options.plugins,
      fullPage: options.fullPage
    });

    process.exit(snapSuccess ? 0 : 1);
  }

  // 2. Scenario-based test execution
  if (!options.scenario && !options.all) {
    console.error('❌ Please specify a scenario (--scenario=name), run --all, or use: npx agent-lens snap --url=http://localhost:5173');
    printHelp();
    process.exit(1);
  }

  const scenariosDir = resolveScenariosDirectory(options.dir);
  const scenarioPaths = await findScenarios(scenariosDir, options.scenario);

  if (scenarioPaths.length === 0) {
    console.error(`❌ No scenarios found in ${scenariosDir}`);
    console.log(`💡 Generate a template with: npx agent-lens init`);
    process.exit(1);
  }

  const shouldBuild = options.build || fileConfig.autoBuild;
  if (shouldBuild) {
    const buildCmd = typeof options.build === 'string'
      ? options.build
      : (fileConfig.buildCommand || 'npm run build');

    console.log(`\n🔨 [Build] Running build process: "${buildCmd}"...`);
    try {
      execSync(buildCmd, { stdio: 'inherit', cwd: options.startCwd || process.cwd() });
    } catch (e) {
      console.error(`❌ Build failed: ${buildCmd}`);
      process.exit(1);
    }
  } else if (options.mode === 'preview' && !options.url && !options.start) {
    console.log(`⚠️  Warning: Running without --build or --url flag. Make sure your frontend is built!`);
  }

  console.log(`📋 Found ${scenarioPaths.length} scenario(s) in: ${scenariosDir}`);

  // Initialize JITI for seamless TypeScript loading
  const jiti = createJiti(process.cwd());

  // Check for global mocks
  let globalMocks: any[] = [];
  const mockCandidates = [
    path.join(scenariosDir, 'mocks.ts'),
    path.join(scenariosDir, 'mocks.js'),
    path.join(process.cwd(), 'mocks.ts'),
    path.join(process.cwd(), 'mocks.js')
  ];

  for (const mocksPath of mockCandidates) {
    if (fs.existsSync(mocksPath)) {
      try {
        const m = await jiti.import(mocksPath) as any;
        globalMocks = m.default || m.mocks || [];
        console.log(`🌍 Loaded ${globalMocks.length} global mock(s) from ${path.basename(mocksPath)}`);
        break;
      } catch (err) {
        console.warn(`⚠️ Failed to load global mocks from ${mocksPath}:`, err);
      }
    }
  }

  // Auto-load mock-ipc plugin if global mocks or scenario mockIpc are present
  if (globalMocks.length > 0 && !options.plugins?.includes('mock-ipc')) {
    options.plugins = ['mock-ipc', ...(options.plugins || [])];
  }

  let allSuccess = true;
  for (const scenarioPath of scenarioPaths) {
    try {
      const scenarioModule = await jiti.import(scenarioPath) as any;
      const scenario: VisualScenario = scenarioModule.default || scenarioModule.scenario;

      if (!scenario || typeof scenario.run !== 'function') {
        console.error(`⚠️ Skipped: file ${path.basename(scenarioPath)} does not export a VisualScenario object by default.`);
        continue;
      }

      // If scenario requires mockIpc, ensure plugin is active
      const scenarioPlugins = [...(options.plugins || [])];
      if (scenario.mockIpc && scenario.mockIpc.length > 0 && !scenarioPlugins.includes('mock-ipc')) {
        scenarioPlugins.push('mock-ipc');
      }

      const result = await runVisualScenario({
        scenario,
        targetMode: options.mode as any,
        url: options.url,
        startCommand: options.start,
        startCwd: options.startCwd,
        cleanArtifacts: options.cleanArtifacts,
        port: options.port,
        headed: options.headed,
        detach: options.detach,
        executablePath: options.exe,
        cleanPaths: options.clean,
        desktopEnv: fileConfig.env,
        wwwrootDir: options.wwwroot ? resolveWwwrootDir(options.wwwroot) : undefined,
        artifactsRoot: options.outDir ? path.resolve(process.cwd(), options.outDir) : undefined,
        globalMocks,
        plugins: scenarioPlugins
      });

      if (!result.success) {
        allSuccess = false;
      }
    } catch (err: any) {
      console.error(`❌ Failed to load scenario ${path.basename(scenarioPath)}:`, err);
      allSuccess = false;
    }
  }

  if (!allSuccess) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
}
