import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncLatestArtifacts } from '../../../features/runner/lib/artifactsSync';
import type { SnapshotMetadata } from '../../../shared/api/dsl';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-lens-test-'));
}

describe('syncLatestArtifacts()', () => {
  let artifactsRoot: string;
  let scenarioDir: string;

  beforeEach(() => {
    artifactsRoot = makeTempDir();
    scenarioDir = path.join(artifactsRoot, 'my-scenario_2026-09-24T10-00-00');
    fs.mkdirSync(scenarioDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(artifactsRoot, { recursive: true, force: true });
  });

  it('creates artifacts/latest/ directory', () => {
    const reportPath = path.join(scenarioDir, 'report.md');
    fs.writeFileSync(reportPath, '# Report');

    syncLatestArtifacts(artifactsRoot, scenarioDir, reportPath, []);

    expect(fs.existsSync(path.join(artifactsRoot, 'latest'))).toBe(true);
  });

  it('copies report.md to latest/', () => {
    const reportPath = path.join(scenarioDir, 'report.md');
    fs.writeFileSync(reportPath, '# My Test Report');

    syncLatestArtifacts(artifactsRoot, scenarioDir, reportPath, []);

    const latestReport = path.join(artifactsRoot, 'latest', 'report.md');
    expect(fs.existsSync(latestReport)).toBe(true);
    expect(fs.readFileSync(latestReport, 'utf-8')).toBe('# My Test Report');
  });

  it('copies snapshot PNG files to latest/', () => {
    const reportPath = path.join(scenarioDir, 'report.md');
    fs.writeFileSync(reportPath, '');

    const snapPath = path.join(scenarioDir, 'snap_01.png');
    fs.writeFileSync(snapPath, 'PNG_DATA');

    const snapshots: SnapshotMetadata[] = [{
      index: 1,
      name: 'Initial State',
      fileName: 'snap_01.png',
      filePath: snapPath,
      relativeUri: './snap_01.png',
      viewport: { width: 1200, height: 800 },
      timestamp: new Date().toISOString()
    }];

    syncLatestArtifacts(artifactsRoot, scenarioDir, reportPath, snapshots);

    expect(fs.existsSync(path.join(artifactsRoot, 'latest', 'snap_01.png'))).toBe(true);
  });

  it('copies plugin-generated files (a11y-tree.md, *_diff.png) to latest/', () => {
    const reportPath = path.join(scenarioDir, 'report.md');
    fs.writeFileSync(reportPath, '');

    // Simulate plugin-generated files
    fs.writeFileSync(path.join(scenarioDir, 'a11y-tree.md'), '# A11Y Tree');
    fs.writeFileSync(path.join(scenarioDir, 'snap_01_diff.png'), 'DIFF_PNG');
    fs.writeFileSync(path.join(scenarioDir, 'recording.webm'), 'VIDEO_DATA');

    syncLatestArtifacts(artifactsRoot, scenarioDir, reportPath, []);

    expect(fs.existsSync(path.join(artifactsRoot, 'latest', 'a11y-tree.md'))).toBe(true);
    expect(fs.existsSync(path.join(artifactsRoot, 'latest', 'snap_01_diff.png'))).toBe(true);
    expect(fs.existsSync(path.join(artifactsRoot, 'latest', 'recording.webm'))).toBe(true);
  });

  it('overwrites existing latest/ on consecutive runs', () => {
    // First run
    const report1 = path.join(scenarioDir, 'report.md');
    fs.writeFileSync(report1, '# Run 1');
    syncLatestArtifacts(artifactsRoot, scenarioDir, report1, []);
    expect(fs.readFileSync(path.join(artifactsRoot, 'latest', 'report.md'), 'utf-8')).toBe('# Run 1');

    // Second run
    fs.writeFileSync(report1, '# Run 2');
    syncLatestArtifacts(artifactsRoot, scenarioDir, report1, []);
    expect(fs.readFileSync(path.join(artifactsRoot, 'latest', 'report.md'), 'utf-8')).toBe('# Run 2');
  });

  it('does not fail if report file does not exist (graceful)', () => {
    const missingReport = path.join(scenarioDir, 'nonexistent-report.md');
    expect(() => syncLatestArtifacts(artifactsRoot, scenarioDir, missingReport, [])).not.toThrow();
  });

  it('returns the path to latest/report.md', () => {
    const reportPath = path.join(scenarioDir, 'report.md');
    fs.writeFileSync(reportPath, '');
    const result = syncLatestArtifacts(artifactsRoot, scenarioDir, reportPath, []);
    expect(result).toBe(path.join(artifactsRoot, 'latest', 'report.md'));
  });
});
