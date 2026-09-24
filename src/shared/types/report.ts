import type { SnapshotMetadata, VisualScenario } from '../api/dsl';
import type { ConsoleEntry } from './console';

export interface ReportSection {
  title: string;
  content: string;
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
}
