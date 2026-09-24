import path from 'path';
import fs from 'fs';
import { runVisualScenario } from '../runner/runner';
import { defineVisualTest, VIEWPORT_PRESETS, type ViewportPreset } from '../../shared/api/dsl';
import { resolveWwwrootDir } from '../../shared/lib/config';

export interface SnapCliOptions {
  url?: string;
  start?: string;
  startCwd?: string;
  selector?: string;
  viewports?: string[];
  waitMs?: number;
  name?: string;
  clean?: string[];
  cleanArtifacts?: boolean;
  headed?: boolean;
  detach?: boolean;
  outDir?: string;
    mode?: 'desktop' | 'preview';
  exe?: string;
  port?: number;
  plugins?: (string | any)[];
  fullPage?: boolean;
}

const PRESET_MAP: Record<string, ViewportPreset> = {
        
  default: VIEWPORT_PRESETS.DEFAULT,
  desktop: VIEWPORT_PRESETS.DEFAULT,
  min: VIEWPORT_PRESETS.MIN_SUPPORTED,
  'min-supported': VIEWPORT_PRESETS.MIN_SUPPORTED,
  wide: VIEWPORT_PRESETS.WIDE,
  mobile: { name: 'mobile', width: 375, height: 667 },
  tablet: { name: 'tablet', width: 768, height: 1024 },
  'full-hd': VIEWPORT_PRESETS.FULL_HD
};

function parseViewportPresets(raw?: string[]): ViewportPreset[] {
  if (!raw || raw.length === 0) {
    return [VIEWPORT_PRESETS.DEFAULT, PRESET_MAP.mobile];
  }

  const presets: ViewportPreset[] = [];
  for (const item of raw) {
    const lower = item.toLowerCase().trim();
    if (PRESET_MAP[lower]) {
      presets.push(PRESET_MAP[lower]);
    } else if (lower.includes('x')) {
      const [w, h] = lower.split('x').map((n) => parseInt(n, 10));
      if (!isNaN(w) && !isNaN(h)) {
        presets.push({ name: `${w}x${h}`, width: w, height: h });
      }
    }
  }

  return presets.length > 0 ? presets : [VIEWPORT_PRESETS.DEFAULT, PRESET_MAP.mobile];
}

const CANDIDATE_PORTS = [5173, 3000, 4321, 4200, 8080, 8000, 3001];

async function isPortResponding(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    return Boolean(res.status);
  } catch {
    return false;
  }
}

async function detectActiveDevServer(): Promise<string | null> {
  for (const port of CANDIDATE_PORTS) {
    const url = `http://localhost:${port}`;
    if (await isPortResponding(url)) {
      return url;
    }
  }
  return null;
}

export async function runQuickSnap(options: SnapCliOptions): Promise<boolean> {
  let targetUrl = options.url;
  let useStaticPreview = false;
  let wwwrootDir: string | undefined;

  // Smart URL/Server Resolution when neither --url nor --start is explicitly provided
  if (!targetUrl && !options.start) {
    const activeUrl = await detectActiveDevServer();
    if (activeUrl) {
      targetUrl = activeUrl;
      console.log(`🌐 [Quick Snap] Detected active dev server on ${targetUrl}`);
    } else {
      // Check for compiled static files (dist, build, wwwroot)
      const candidateDir = resolveWwwrootDir();
      if (fs.existsSync(candidateDir) && fs.existsSync(path.join(candidateDir, 'index.html'))) {
        useStaticPreview = true;
        wwwrootDir = candidateDir;
        console.log(`📦 [Quick Snap] No active server found. Detected built static directory at "${candidateDir}". Launching static preview...`);
      } else {
        console.error(`\n❌ [Quick Snap] No active server found on common ports (${CANDIDATE_PORTS.join(', ')}), and no static build found.`);
        console.log(`💡 Suggested actions:`);
        console.log(`   1. Pass a start command:  npx agent-lens snap --start="npm run dev"`);
        console.log(`   2. Specify your URL:      npx agent-lens snap --url=http://localhost:8080`);
        console.log(`   3. Build your static app: npm run build\n`);
        return false;
      }
    }
  } else if (!targetUrl && options.start) {
    targetUrl = 'http://localhost:5173';
  }
        

  const waitMs = options.waitMs ?? 1000;
  const snapshotPrefix = options.name || 'quick_snap';
  const targetViewports = parseViewportPresets(options.viewports);

  console.log(`\n📸 [Quick Snap] Preparing instant verification for: ${targetUrl || wwwrootDir}`);
  console.log(`📐 [Quick Snap] Testing ${targetViewports.length} viewports: ${targetViewports.map((v) => `${v.name} (${v.width}x${v.height})`).join(', ')}`);
  if (options.selector) {
    console.log(`🎯 [Quick Snap] Focused element selector: "${options.selector}"`);
  }

  const snapScenario = defineVisualTest({
    id: 'quick-snap',
    title: `Quick Verification: ${targetUrl || 'Static Preview'}`,
    description: `One-shot automated snapshot and console health check`,
    route: targetUrl || '/',
    viewports: targetViewports,
    run: async (ctx) => {
      ctx.log(`Waiting ${waitMs}ms for page stabilization...`);
      await ctx.wait(waitMs);

      for (let i = 0; i < targetViewports.length; i++) {
        const vp = targetViewports[i];
        const stepNum = String(i + 1).padStart(2, '0');
        ctx.log(`Switching viewport to: ${vp.name} (${vp.width}x${vp.height})`);
        await ctx.setPreset(vp);
        await ctx.wait(200);
        await ctx.capture(`${stepNum}_${snapshotPrefix}_${vp.name}`, { fullPage: options.fullPage });
      }

      if (options.selector) {
        ctx.log(`Focusing on selector: "${options.selector}"`);
        try {
          await ctx.setPreset(VIEWPORT_PRESETS.DEFAULT);
          await ctx.resizeToFit(options.selector, 15);
          await ctx.capture(`99_${snapshotPrefix}_element_focus`, { selector: options.selector });
        } catch (err: any) {
          ctx.log(`⚠️ Could not isolate selector "${options.selector}": ${err.message}`);
        }
      }

      const errors = ctx.getConsoleErrors();
      if (errors.length > 0) {
        ctx.log(`🚨 Caught ${errors.length} console errors during snap check!`);
      } else {
        ctx.log(`✅ Clean run: No console errors detected.`);
      }
    }
  });

  const result = await runVisualScenario({
    scenario: snapScenario,
    targetMode: options.mode || 'preview',
    url: useStaticPreview ? undefined : targetUrl,
    wwwrootDir: useStaticPreview ? wwwrootDir : undefined,
    startCommand: options.start,
    startCwd: options.startCwd,
    executablePath: options.exe,
    cleanPaths: options.clean,
        cleanArtifacts: options.cleanArtifacts,
    port: options.port,
    headed: options.headed,
    detach: options.detach,
    artifactsRoot: options.outDir ? path.resolve(process.cwd(), options.outDir) : undefined,
    plugins: options.plugins
  });
        

  console.log(`\n========================================`);
  console.log(`🏁 Quick Snap Finished!`);
  console.log(`📸 Snapshots: ${result.totalSnapshots}`);
  console.log(`🔴 Console Errors: ${result.consoleErrors}`);
  console.log(`🟡 Console Warnings: ${result.consoleWarnings}`);
  console.log(`📄 Report: ${result.reportPath}`);
  console.log(`========================================\n`);

  return result.success && result.consoleErrors === 0;
}
