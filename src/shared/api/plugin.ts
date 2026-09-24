import type { Page, BrowserContext, Browser } from 'playwright';
import type { TestContext, VisualScenario } from './dsl';
import type { ReportData } from '../types/report';

export interface DriverLaunchResult {
  page: Page;
  context: BrowserContext;
  browser?: Browser;
  stop?: () => Promise<void>;
}

export interface PluginHookContext {
  scenario?: VisualScenario;
  targetMode: 'desktop' | 'preview' | string;
  artifactsDir: string;
  cliOptions?: Record<string, unknown>;
  state: Map<string, unknown>;
}

export interface AgentLensPlugin {
  /** Unique plugin identifier (e.g. 'desktop-webview2', 'live-controller', 'mock-ipc') */
  name: string;
  version?: string;

  /** Lifecycle hook: initial setup before drivers and scenarios start */
  setup?: (context: PluginHookContext) => Promise<void> | void;

  /**
   * Microkernel driver hook: allows a plugin to provide a custom browser/page session
   * (e.g., desktop WebView2 CDP connection, custom remote browser).
   */
  launchSession?: (
    options: { currentViewport: { width: number; height: number }; headed?: boolean },
    hookContext: PluginHookContext
  ) => Promise<DriverLaunchResult | undefined>;

  /** Lifecycle hook: called when browser context is ready */
  onContextCreated?: (context: BrowserContext, hookContext: PluginHookContext) => Promise<void> | void;

  /** Lifecycle hook: called when the test page is created/navigated */
  onPageCreated?: (page: Page, context: BrowserContext, hookContext: PluginHookContext) => Promise<void> | void;

  /**
   * Context extension: inject custom methods or properties directly into TestContext (ctx)
   */
  extendContext?: (
    ctx: TestContext,
    page: Page,
    hookContext: PluginHookContext
  ) => Record<string, any> | Promise<Record<string, any>>;

  /** Lifecycle hook: called after scenario runs and report data is calculated */
  onAfterRun?: (reportData: ReportData, hookContext: PluginHookContext) => Promise<void> | void;

  /** Lifecycle hook: teardown and cleanup guaranteed to run */
  teardown?: (hookContext: PluginHookContext) => Promise<void> | void;
}

export function definePlugin(plugin: AgentLensPlugin): AgentLensPlugin {
  return plugin;
}