import type { SnapshotMetadata, VisualScenario } from '../api/dsl';
import type { ConsoleEntry } from './console';

export interface ReportSection {
  title: string;
  content: string;
}

/** Captures errors thrown by plugin lifecycle hooks (setup, teardown, etc.) */
export interface PluginError {
  pluginName: string;
  hook: 'setup' | 'launchSession' | 'onContextCreated' | 'onPageCreated' | 'extendContext' | 'onAfterRun' | 'teardown';
  message: string;
  stack?: string;
}

export interface ReportData {
  scenario: VisualScenario;
  snapshots: SnapshotMetadata[];
  consoleErrors: ConsoleEntry[];
  consoleWarnings: ConsoleEntry[];
  outputDir: string;
  targetMode: 'desktop' | 'preview' | string;
  durationMs: number;
  customSections?: ReportSection[];
  pluginErrors?: PluginError[];
}
