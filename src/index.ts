/**
 * AgentLens - Visual UI self-verification engine for AI agents
 */

// DSL, scenario definitions, plugins & contracts
export * from './shared/api/dsl';
export * from './shared/api/plugin';
export * from './shared/types/console';
export * from './shared/types/ipc';
export * from './shared/types/report';

// Core execution engine & features
export { runVisualScenario, type RunOptions, type RunResult } from './features/runner/runner';
export { runQuickSnap, type SnapCliOptions } from './features/snap/snap';
export { ConsoleTracker } from './features/console-tracker/consoleTracker';
export { CaptureEngine } from './features/capture/capture';
export { VisualReporter } from './features/reporter/reporter';

// Configuration utilities
export {
  loadConfig,
  type AgentLensConfigFile,
  resolveWwwrootDir,
  detectStartCwd
} from './shared/lib/config';

// Plugin management
export { PluginManager } from './shared/lib/pluginLoader';
