#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { runVisualScenario } from '../features/runner/runner';
import type { VisualScenario } from '../shared/api/dsl';
import { createJiti } from 'jiti';
import { loadConfig, resolveWwwrootDir, detectStartCwd } from '../shared/lib/config';
import { runQuickSnap } from '../features/snap/snap';

// 1. Load config from agent-lens.json or package.json
const fileConfig = loadConfig();

// 2. Parse CLI Arguments
const args = process.argv.slice(2);

// Check subcommands
if (args[0] === 'init') {
  initScenarioTemplate();
  process.exit(0);
}

const isSnapCommand = args[0] === 'snap';
const effectiveArgs = isSnapCommand ? args.slice(1) : args;

const options: {
  scenario?: string;
  mode: 'desktop' | 'preview';
  all?: boolean;
  port: number;
  help?: boolean;
  headed?: boolean;
  detach?: boolean;
  build?: boolean | string;
  start?: string;
  startCwd?: string;
  cleanArtifacts?: boolean;
  url?: string;
  selector?: string;
  viewports?: string[];
  waitMs?: number;
  name?: string;
  exe?: string;
  clean?: string[];
  dir?: string;
  wwwroot?: string;
  outDir?: string;
} = {
  mode: fileConfig.mode || 'preview',
  port: fileConfig.port || 9222,
  headed: fileConfig.headed ?? false,
  detach: fileConfig.detach ?? false,
  build: fileConfig.buildCommand || false,
  start: fileConfig.startCommand,
  startCwd: fileConfig.startCwd,
  cleanArtifacts: fileConfig.cleanArtifacts ?? false,
  url: fileConfig.url,
  exe: fileConfig.executablePath,
  clean: Array.isArray(fileConfig.clean) ? fileConfig.clean : (fileConfig.clean ? [fileConfig.clean] : undefined),
  dir: fileConfig.scenarios,
  wwwroot: fileConfig.wwwroot,
  outDir: fileConfig.outDir
};

for (const arg of effectiveArgs) {
  if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else if (arg.startsWith('--scenario=')) {
    options.scenario = arg.split('=')[1];
  } else if (arg === '--all') {
    options.all = true;
  } else if (arg.startsWith('--mode=')) {
    const mode = arg.split('=')[1].toLowerCase();
    if (mode === 'desktop' || mode === 'preview') {
      options.mode = mode as 'desktop' | 'preview';
    }
  } else if (arg.startsWith('--port=')) {
    options.port = parseInt(arg.split('=')[1], 10) || 9222;
  } else if (arg === '--headed') {
    options.headed = true;
  } else if (arg === '--detach') {
    options.detach = true;
  } else if (arg === '--build') {
    options.build = true;
  } else if (arg.startsWith('--build=')) {
    options.build = arg.slice('--build='.length);
  } else if (arg.startsWith('--start=')) {
    options.start = arg.slice('--start='.length);
  } else if (arg.startsWith('--start-cwd=') || arg.startsWith('--cwd=')) {
    options.startCwd = arg.split('=')[1];
  } else if (arg === '--clean-artifacts') {
    options.cleanArtifacts = true;
  } else if (arg.startsWith('--url=')) {
    options.url = arg.split('=')[1];
  } else if (arg.startsWith('--selector=')) {
    options.selector = arg.split('=')[1];
  } else if (arg.startsWith('--viewports=')) {
    options.viewports = arg.split('=')[1].split(',').map((v) => v.trim()).filter(Boolean);
  } else if (arg.startsWith('--wait=')) {
    options.waitMs = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--name=')) {
    options.name = arg.split('=')[1];
  } else if (arg.startsWith('--exe=') || arg.startsWith('--executable=')) {
    options.exe = arg.split('=')[1];
  } else if (arg.startsWith('--clean=') || arg.startsWith('--cleanup=')) {
    const rawPaths = arg.split('=')[1];
    options.clean = rawPaths.split(',').map((p) => p.trim()).filter(Boolean);
  } else if (arg.startsWith('--dir=')) {
    options.dir = arg.split('=')[1];
  } else if (arg.startsWith('--wwwroot=')) {
    options.wwwroot = arg.split('=')[1];
  } else if (arg.startsWith('--outDir=') || arg.startsWith('--folder=')) {
    options.outDir = arg.split('=')[1];
  }
}

// Auto-detect startCwd if a start command was provided in a monorepo setup
if (options.start && !options.startCwd) {
  options.startCwd = detectStartCwd(options.startCwd);
}

function printHelp() {
  console.log(`
👁️ AgentLens - Visual UI Self-Verification for AI Agents

Usage:
  npx agent-lens snap [options]      Instant one-shot visual & console check (no test files needed)
  npx agent-lens [options]           Run scripted scenario tests from scenarios/
  npx agent-lens init                Generate starter scenario template & mocks

Commands:
  snap                 Take immediate multi-viewport screenshots of a URL & check console errors
  init                 Generate starter template in scenarios/template.scenario.ts and mocks.ts

Options:
  --url=<url>          Target URL to test (e.g. http://localhost:5173 or http://localhost:3000)
  --start="<cmd>"      Launch dev server or backend process before testing (e.g. --start="npm run dev")
  --start-cwd=<path>   Directory to execute --start command in (e.g. --start-cwd=./Frontend)
  --clean-artifacts    Purge previous test artifacts to prevent folder bloat
  --selector=<css>     Target a specific element to focus on / resize-to-fit
  --viewports=<list>   Comma-separated viewport presets (default: desktop,mobile; or 1200x800,375x667)
  --wait=<ms>          Wait time in milliseconds after loading before snapshotting [default: 1000]
  --name=<prefix>      Custom name prefix for captured snapshots [default: quick_snap]
  --scenario=<name>    Run specific scenario by name (e.g. --scenario=smoke)
  --all                Run all discovered scenarios
  --mode=<mode>        Engine mode: 'preview' (Web/Vite/Live) or 'desktop' (WebView2/CDP) [default: preview]
  --exe=<path>         Path to native executable for desktop mode (e.g. --exe=bin/MyApp.exe)
  --port=<port>        CDP remote debugging port [default: 9222]
  --build[=<cmd>]      Run build command before testing (e.g. --build="dotnet build" or npm run build)
  --clean=<paths>      Comma-separated paths to safely delete upon test exit (e.g. --clean="./temp,./cache")
  --headed             Show Chromium browser window
  --detach             Keep browser/app open after finishing
  --dir=<path>         Custom scenarios directory [default: scenarios]
  --wwwroot=<path>     Custom directory for static fallback mode [default: dist]
  --folder=<path>      Directory to save visual artifacts/reports (also --outDir)
  --help, -h           Show this help message
  `);
}

function initScenarioTemplate() {
  const targetDir = path.resolve(process.cwd(), 'scenarios');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Generate template.scenario.ts
  const templatePath = path.join(targetDir, 'template.scenario.ts');
  if (!fs.existsSync(templatePath)) {
    const templateContent = `import { defineVisualTest, VIEWPORT_PRESETS } from 'agent-lens';

export default defineVisualTest({
  id: 'template-check',
  title: 'Basic UI Smoke & Responsiveness Check',
  route: '/',
  // Optional setup hook before test runs
  setup: async () => {
    // prepare test files or folders
  },
  run: async (ctx) => {
    ctx.log('Initial page render');
    await ctx.capture('01_initial_state');

    // Test adaptive layout
    await ctx.setPreset(VIEWPORT_PRESETS.MIN_SUPPORTED);
    await ctx.capture('02_compact_view');

    // Check for JavaScript / React runtime errors
    const errors = ctx.getConsoleErrors();
    if (errors.length > 0) {
      ctx.log(\`⚠️ Warning: Caught \${errors.length} console errors!\`);
    }
  },
  // Optional teardown hook guaranteed to run on exit
  teardown: async () => {
    // clean up temporary test files or state
  }
});
`;
    fs.writeFileSync(templatePath, templateContent, 'utf8');
    console.log(`✅ Starter scenario generated at: ${templatePath}`);
  } else {
    console.log(`ℹ️ Template already exists at: ${templatePath}`);
  }

  // 2. Generate starter mocks.ts to prevent root app crash
  const mocksPath = path.join(targetDir, 'mocks.ts');
  if (!fs.existsSync(mocksPath)) {
    const mocksContent = `/**
 * Global IPC & API Mocks
 * 
 * Export an array of base mocks to satisfy root application state on boot.
 */
export default [
  { action: 'GET_PREFS', data: { theme: 'dark', language: 'en' } },
  { action: 'GET_USER_PROFILE', data: { id: 1, name: 'Agent', role: 'admin' } }
];
`;
    fs.writeFileSync(mocksPath, mocksContent, 'utf8');
    console.log(`✅ Base global mocks generated at: ${mocksPath}`);
  }

  console.log(`👉 Run tests with: npx agent-lens --scenario=template --mode=preview`);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

async function findScenarios(dir: string, specificName?: string): Promise<string[]> {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...await findScenarios(fullPath, specificName));
    } else if (item.name.endsWith('.scenario.ts') || item.name.endsWith('.scenario.js')) {
      if (!specificName || item.name.startsWith(specificName)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function resolveScenariosDirectory(customDir?: string): string {
  if (customDir) {
    return path.resolve(process.cwd(), customDir);
  }

  const candidates = [
    'scenarios',
    'tests/visual',
    'tests/scenarios',
    'test/scenarios',
    'src/scenarios'
  ];

  for (const c of candidates) {
    const p = path.resolve(process.cwd(), c);
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return path.resolve(process.cwd(), 'scenarios');
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
      mode: options.mode,
      exe: options.exe,
      port: options.port
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
    const { execSync } = require('child_process');
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

  let allSuccess = true;
  for (const scenarioPath of scenarioPaths) {
    try {
      const scenarioModule = await jiti.import(scenarioPath) as any;
      const scenario: VisualScenario = scenarioModule.default || scenarioModule.scenario;

      if (!scenario || typeof scenario.run !== 'function') {
        console.error(`⚠️ Skipped: file ${path.basename(scenarioPath)} does not export a VisualScenario object by default.`);
        continue;
      }

      const result = await runVisualScenario({
        scenario,
        targetMode: options.mode,
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
        globalMocks
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
