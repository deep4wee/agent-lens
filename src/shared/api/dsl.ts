import type { Page, BrowserContext } from 'playwright';
import type { ConsoleEntry } from '../../features/console-tracker/consoleTracker';
import type { MockIpcResponseType } from '../../features/mock-ipc/mockIpc';

export interface ViewportPreset {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORT_PRESETS = {
  /** Minimum supported window size (e.g., ) */
  MIN_SUPPORTED: { name: 'min-supported', width: 1024, height: 768 } as ViewportPreset,
  /** Standard default window size (e.g., ) */
  DEFAULT: { name: 'default', width: 1200, height: 800 } as ViewportPreset,
  /** Wide screen for checking grids and tables */
  WIDE: { name: 'wide', width: 1600, height: 900 } as ViewportPreset,
  /** Full HD */
  FULL_HD: { name: 'full-hd', width: 1920, height: 1080 } as ViewportPreset,
};

export interface MockRouteEntry {
  url: string;
  method?: string;
  status?: number;
  body: any;
  delayMs?: number;
  headers?: Record<string, string>;
}

export interface CaptureOptions {
  selector?: string;
  fullPage?: boolean;
  mask?: string[];
}
        

export interface CaptureBurstOptions {
  /** Total duration of burst animation capture in milliseconds */
  durationMs: number;
  /** Interval between frames in milliseconds (default: 80ms) */
  intervalMs?: number;
  /** Restrict capture to a specific element */
  selector?: string;
}

export interface SnapshotMetadata {
  index: number;
  name: string;
  fileName: string;
  filePath: string;
  relativeUri: string;
  viewport: { width: number; height: number };
  timestamp: string;
  isBurstFrame?: boolean;
  burstGroup?: string;
  frameIndex?: number;
  selector?: string;
}

export interface TestContext {
  page: Page;
  context: BrowserContext;
  targetMode: 'desktop' | 'preview';
  currentViewport: { width: number; height: number };
  
  // --- Snapshots ---

  /** Capture a single high-quality snapshot of the window or element */
  capture: (name: string, options?: CaptureOptions) => Promise<SnapshotMetadata>;
  
  /** Capture a series of frames for animations (Framer Motion, modals, lists) */
  captureBurst: (name: string, options: CaptureBurstOptions) => Promise<SnapshotMetadata[]>;
  
  // --- Navigation ---

  /** 
   * Dynamically navigate to another page during the test.
   * Example: await ctx.navigate('/settings');
   */
  navigate: (route: string) => Promise<void>;

  // --- Viewport ---

  /** Change window / viewport size */
  resize: (width: number, height: number) => Promise<void>;
  
  /** Set one of the standard presets (MIN_SUPPORTED, DEFAULT, WIDE) */
  setPreset: (preset: ViewportPreset) => Promise<void>;

  /** 
   * Dynamically resize the window so it perfectly fits the specified element (or body).
   * Useful when an agent wants to test an isolated component without background clutter.
   */
  resizeToFit: (selector?: string, padding?: number) => Promise<void>;
  
  // --- Waiting ---

  /** Wait the specified amount of milliseconds */
  wait: (ms: number) => Promise<void>;
  
  /** Wait for the selector to appear in the DOM */
  waitForSelector: (selector: string, timeoutMs?: number) => Promise<void>;
  
  // --- Interaction ---

  /** Left-click the element */
  click: (selector: string) => Promise<void>;
  
  /** Right-click the element (Context Menu) */
  rightClick: (selector: string) => Promise<void>;
  
  /** Type text into an input field */
  type: (selector: string, text: string) => Promise<void>;
  
  /** Select an option in a <select> by its value */
  selectOption: (selector: string, value: string) => Promise<void>;
  
  /** Hover the cursor to check highlights / tooltips */
  hover: (selector: string) => Promise<void>;
  
  /** Scroll the element (or window) down by the specified number of pixels */
  scroll: (selector: string, deltaY: number) => Promise<void>;
  
  // --- Logging ---

  /** Log a step for the agent */
  log: (message: string) => void;

    // --- Mock IPC & Network Routes (preview mode only) ---

  /**
   * Set a mock response for an IPC action.
   * Changes the data returned by window.__mockIpc.invoke or hybrid bridges in preview mode.
   * Ignored in desktop mode (IPC goes through real backend).
   */
  setMockIpc: (action: string, data: any, options?: { type?: MockIpcResponseType; delayMs?: number }) => Promise<void>;

  /**
   * Mock an HTTP REST or GraphQL network request in preview mode.
   * Intercepts fetch/axios calls matching the URL pattern and returns mock data.
   *
   * Example:
   *   await ctx.setMockRoute('/api/user', { id: 1, name: 'Agent' });
   *   await ctx.setMockRoute('**\/api/items*', [], { status: 200, delayMs: 50 });
   */
  setMockRoute: (
    url: string,
    body: any,
    options?: { method?: string; status?: number; delayMs?: number; headers?: Record<string, string> }
  ) => Promise<void>;

  // --- Console Errors ---
        

  /** Return all intercepted console.error and pageerror logs */
  getConsoleErrors: () => ConsoleEntry[];

  /** Return all intercepted console.warn logs */
  getConsoleWarnings: () => ConsoleEntry[];

  /** Returns true if there are critical errors in the console */
  hasConsoleErrors: () => boolean;

  // --- DOM Assertions ---

  /** Get the visible text of a specific element */
  readText: (selector: string) => Promise<string | null>;
  
  /** Get ALL visible text on the page (useful for quick analysis without Vision) */
  getPageText: () => Promise<string>;
  
  /** Check if the element is visible on the screen */
  isVisible: (selector: string) => Promise<boolean>;

  /** Count the number of elements matching the selector */
  getElementCount: (selector: string) => Promise<number>;
}

export interface VisualScenario {
  /** Unique scenario identifier (kebab-case) */
  id: string;
  /** Human-readable title for the report */
  title: string;
  /** Description of what is being tested */
  description?: string;
  /** Initial route to navigate to (e.g., '/instances', '/settings') */
  route?: string;
  /** List of viewport sizes to test */
  viewports?: ViewportPreset[];
    /**
   * Initial IPC mock data for preview mode.
   * Applied BEFORE navigation to the route.
   */
  mockIpc?: Array<{ action: string; data: any; type?: MockIpcResponseType; delayMs?: number }>;
  /**
   * Initial HTTP REST/GraphQL route mocks for preview mode.
   * Applied BEFORE navigation to the route.
   */
  mockRoutes?: MockRouteEntry[];
  /**
   * Optional setup hook: executed before the browser navigates and scenario runs.
   * Ideal for preparing mock files, test directories, or initial state.
   */
        
  setup?: () => Promise<void> | void;
  /** The main body of the scenario */
  run: (ctx: TestContext) => Promise<void>;
  /**
   * Optional teardown hook: guaranteed to execute in finally, even if run() fails.
   * Ideal for cleaning up test artifacts, cache directories, or temporary state.
   */
  teardown?: () => Promise<void> | void;
}

export function defineVisualTest(scenario: VisualScenario): VisualScenario {
  return scenario;
}
