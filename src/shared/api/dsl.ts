import type { Page, BrowserContext } from 'playwright';
import type { ConsoleEntry } from '../types/console';
import type { MockIpcResponseType } from '../types/ipc';
import type { AgentLensPlugin } from './plugin';

export * from './plugin';
export * from '../types/console';
export * from '../types/ipc';

export interface ViewportPreset {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORT_PRESETS = {
  /** Minimum supported window size */
  MIN_SUPPORTED: { name: 'min-supported', width: 1024, height: 768 } as ViewportPreset,
  /** Standard default window size */
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
  [key: string]: any;
  page: Page;
  context: BrowserContext;
  targetMode: 'desktop' | 'preview';
  currentViewport: { width: number; height: number };

  // --- Snapshots ---
  capture: (name: string, options?: CaptureOptions) => Promise<SnapshotMetadata>;
  captureBurst: (name: string, options: CaptureBurstOptions) => Promise<SnapshotMetadata[]>;

  // --- Navigation ---
  navigate: (route: string) => Promise<void>;

  // --- Viewport ---
  resize: (width: number, height: number) => Promise<void>;
  setPreset: (preset: ViewportPreset) => Promise<void>;
  resizeToFit: (selector?: string, padding?: number) => Promise<void>;

  // --- Waiting ---
  wait: (ms: number) => Promise<void>;
  waitForSelector: (selector: string, timeoutMs?: number) => Promise<void>;

  // --- Interaction ---
  click: (selector: string) => Promise<void>;
  rightClick: (selector: string) => Promise<void>;
  type: (selector: string, text: string) => Promise<void>;
  selectOption: (selector: string, value: string) => Promise<void>;
  hover: (selector: string) => Promise<void>;
  scroll: (selector: string, deltaY: number) => Promise<void>;

  // --- Logging ---
  log: (message: string) => void;

  // --- Mock IPC & Network Routes ---
  setMockIpc: (action: string, data: any, options?: { type?: MockIpcResponseType; delayMs?: number }) => Promise<void>;
  setMockRoute: (
    url: string,
    body: any,
    options?: { method?: string; status?: number; delayMs?: number; headers?: Record<string, string> }
  ) => Promise<void>;

  // --- Console Errors ---
  getConsoleErrors: () => ConsoleEntry[];
  getConsoleWarnings: () => ConsoleEntry[];
  hasConsoleErrors: () => boolean;

  // --- DOM Assertions ---
  readText: (selector: string) => Promise<string | null>;
  getPageText: () => Promise<string>;
  isVisible: (selector: string) => Promise<boolean>;
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
  /** Initial IPC mock data for preview mode */
  mockIpc?: Array<{ action: string; data: any; type?: MockIpcResponseType; delayMs?: number }>;
  /** Initial HTTP REST/GraphQL route mocks for preview mode */
  mockRoutes?: MockRouteEntry[];
  /** Optional plugins required for this scenario */
  plugins?: (string | AgentLensPlugin)[];
  /** Setup hook executed before scenario runs */
  setup?: () => Promise<void> | void;
  /** The main body of the scenario */
  run: (ctx: TestContext) => Promise<void>;
  /** Teardown hook guaranteed to run on completion */
  teardown?: () => Promise<void> | void;
}

export function defineVisualTest(scenario: VisualScenario): VisualScenario {
  return scenario;
}
