import path from 'path';
import fs from 'fs';
import { createJiti } from 'jiti';
import type { AgentLensPlugin, PluginHookContext, DriverLaunchResult } from '../api/plugin';
import type { TestContext } from '../api/dsl';
import type { ReportData, PluginError } from '../types/report';
import type { Page, BrowserContext } from 'playwright';

function findPackageRoot(): string {
  let cur = __dirname;
  while (cur !== path.dirname(cur)) {
    const pkgPath = path.join(cur, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === '@_deep4wee/agent-lens' || pkg.name === 'agent-lens') {
          return cur;
        }
      } catch {
        // ignore
      }
    }
    cur = path.dirname(cur);
  }
  return path.resolve(__dirname, '..');
}

function extractPlugin(mod: any): AgentLensPlugin | null {
  if (!mod || typeof mod !== 'object') return null;
  const candidates = [
    mod.default?.default,
    mod.default,
    mod.plugin,
    mod
  ];
  for (const c of candidates) {
    if (c && typeof c === 'object' && typeof c.name === 'string') {
      return c as AgentLensPlugin;
    }
  }
  for (const key of Object.keys(mod)) {
    const val = mod[key];
    if (val && typeof val === 'object' && typeof val.name === 'string') {
      return val as AgentLensPlugin;
    }
  }
  return null;
}

export class PluginManager {
  private plugins: AgentLensPlugin[] = [];
  private jiti = createJiti(process.cwd());
  private pluginErrors: PluginError[] = [];

  private recordError(
    pluginName: string,
    hook: PluginError['hook'],
    err: unknown
  ): void {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`⚠️ [Plugin] Error in ${pluginName}.${hook}: ${e.message}`);
    this.pluginErrors.push({ pluginName, hook, message: e.message, stack: e.stack });
  }

  public clearErrors(): void {
    this.pluginErrors = [];
  }

  public getPluginErrors(): PluginError[] {
    return [...this.pluginErrors];
  }

  public register(plugin: AgentLensPlugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      return;
    }
    this.plugins.push(plugin);
    console.log(`🔌 [Plugin] Registered: ${plugin.name}${plugin.version ? ` (v${plugin.version})` : ''}`);
  }

  public async load(pluginSpec: string | AgentLensPlugin): Promise<void> {
    if (typeof pluginSpec === 'object' && pluginSpec !== null) {
      this.register(pluginSpec);
      return;
    }

    const pluginNameOrPath = pluginSpec.trim();
    if (!pluginNameOrPath) return;

    // 1. Direct path (relative or absolute)
    if (
      pluginNameOrPath.startsWith('.') ||
      pluginNameOrPath.startsWith('/') ||
      pluginNameOrPath.includes('/') ||
      pluginNameOrPath.includes('\\')
    ) {
      const resolvedPath = path.resolve(process.cwd(), pluginNameOrPath);
      await this.loadFromFile(resolvedPath);
      return;
    }

    // 2. Local convention directories: .agent-lens/plugins/ or plugins/
    const localCandidates = [
      path.resolve(process.cwd(), '.agent-lens', 'plugins', `${pluginNameOrPath}.ts`),
      path.resolve(process.cwd(), '.agent-lens', 'plugins', `${pluginNameOrPath}.js`),
      path.resolve(process.cwd(), 'plugins', `${pluginNameOrPath}.ts`),
      path.resolve(process.cwd(), 'plugins', `${pluginNameOrPath}.js`),
      path.resolve(process.cwd(), '.agent-lens', 'plugins', pluginNameOrPath, 'index.ts'),
      path.resolve(process.cwd(), '.agent-lens', 'plugins', pluginNameOrPath, 'index.js'),
      path.resolve(process.cwd(), 'plugins', pluginNameOrPath, 'index.ts'),
      path.resolve(process.cwd(), 'plugins', pluginNameOrPath, 'index.js')
    ];

    for (const candidate of localCandidates) {
      if (fs.existsSync(candidate)) {
        await this.loadFromFile(candidate);
        return;
      }
    }

    // 3. Built-in plugins in agent-lens
    const pkgRoot = findPackageRoot();
    const builtInCandidates = [
      path.join(pkgRoot, 'src', 'plugins', pluginNameOrPath, 'index.ts'),
      path.join(pkgRoot, 'src', 'plugins', pluginNameOrPath, 'index.js'),
      path.join(pkgRoot, 'dist', 'plugins', pluginNameOrPath, 'index.js'),
      path.join(pkgRoot, 'plugins', pluginNameOrPath, 'index.ts'),
      path.join(pkgRoot, 'plugins', pluginNameOrPath, 'index.js'),
      path.resolve(__dirname, '../../plugins', pluginNameOrPath, 'index.ts'),
      path.resolve(__dirname, '../../plugins', pluginNameOrPath, 'index.js'),
      path.resolve(__dirname, '../plugins', pluginNameOrPath, 'index.ts'),
      path.resolve(__dirname, '../plugins', pluginNameOrPath, 'index.js')
    ];

    for (const builtIn of builtInCandidates) {
      if (fs.existsSync(builtIn)) {
        await this.loadFromFile(builtIn);
        return;
      }
    }

    // 4. Fallback to npm package resolution (e.g. @agent-lens/plugin-xxx)
    try {
      const mod = await this.jiti.import(pluginNameOrPath) as any;
      const plugin = extractPlugin(mod);
      if (plugin) {
        this.register(plugin);
      } else {
        console.warn(`⚠️ [Plugin] Package "${pluginNameOrPath}" did not export a valid AgentLensPlugin.`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.warn(`⚠️ [Plugin] Could not load plugin '${pluginNameOrPath}': ${e.message}`);
    }
  }

  private async loadFromFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ [Plugin] Plugin file not found: ${filePath}`);
      return;
    }

    try {
      const mod = await this.jiti.import(filePath) as any;
      const plugin = extractPlugin(mod);
      if (plugin) {
        this.register(plugin);
      } else {
        console.warn(`⚠️ [Plugin] File "${filePath}" does not export a valid AgentLensPlugin by default.`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error(`❌ [Plugin] Failed to import plugin from ${filePath}:`, e.message);
    }
  }

  public async loadAll(specs: (string | AgentLensPlugin)[]): Promise<void> {
    for (const spec of specs) {
      await this.load(spec);
    }
  }

  public async runSetup(hookContext: PluginHookContext): Promise<void> {
    for (const p of this.plugins) {
      if (p.setup) {
        try {
          await p.setup(hookContext);
        } catch (err: unknown) {
          this.recordError(p.name, 'setup', err);
        }
      }
    }
  }

  public async launchSession(
    options: { currentViewport: { width: number; height: number }; headed?: boolean },
    hookContext: PluginHookContext
  ): Promise<DriverLaunchResult | undefined> {
    for (const p of this.plugins) {
      if (p.launchSession) {
        try {
          const session = await p.launchSession(options, hookContext);
          if (session) {
            return session;
          }
        } catch (err: unknown) {
          this.recordError(p.name, 'launchSession', err);
        }
      }
    }
    return undefined;
  }

  public async runOnContextCreated(context: BrowserContext, hookContext: PluginHookContext): Promise<void> {
    for (const p of this.plugins) {
      if (p.onContextCreated) {
        try {
          await p.onContextCreated(context, hookContext);
        } catch (err: unknown) {
          this.recordError(p.name, 'onContextCreated', err);
        }
      }
    }
  }

  public async runOnPageCreated(page: Page, context: BrowserContext, hookContext: PluginHookContext): Promise<void> {
    for (const p of this.plugins) {
      if (p.onPageCreated) {
        try {
          await p.onPageCreated(page, context, hookContext);
        } catch (err: unknown) {
          this.recordError(p.name, 'onPageCreated', err);
        }
      }
    }
  }

  public async extendContext(ctx: TestContext, page: Page, hookContext: PluginHookContext): Promise<void> {
    for (const p of this.plugins) {
      if (p.extendContext) {
        try {
          const extensions = await p.extendContext(ctx, page, hookContext);
          if (extensions && typeof extensions === 'object') {
            Object.assign(ctx, extensions);
          }
        } catch (err: unknown) {
          this.recordError(p.name, 'extendContext', err);
        }
      }
    }
  }

  public async runOnAfterRun(reportData: ReportData, hookContext: PluginHookContext): Promise<void> {
    for (const p of this.plugins) {
      if (p.onAfterRun) {
        try {
          await p.onAfterRun(reportData, hookContext);
        } catch (err: unknown) {
          this.recordError(p.name, 'onAfterRun', err);
        }
      }
    }
  }

  public async runTeardown(hookContext: PluginHookContext): Promise<void> {
    for (const p of this.plugins) {
      if (p.teardown) {
        try {
          await p.teardown(hookContext);
        } catch (err: unknown) {
          this.recordError(p.name, 'teardown', err);
        }
      }
    }
  }

  public get loadedPlugins(): AgentLensPlugin[] {
    return [...this.plugins];
  }
}