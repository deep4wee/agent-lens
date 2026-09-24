import fs from 'fs';
import path from 'path';
import type { SnapshotMetadata } from '../../../shared/api/dsl';

/**
 * Synchronizes the generated test report and snapshots into artifacts/latest/
 * so agents always have immediate access to the freshest results without parsing timestamps.
 * Also copies all plugin-generated files (a11y-tree.md, *_diff.png, videos, etc.)
 */
export function syncLatestArtifacts(
  artifactsRoot: string,
  scenarioArtifactsDir: string,
  reportPath: string,
  snapshots: SnapshotMetadata[]
): string | undefined {
  try {
    const latestDir = path.join(artifactsRoot, 'latest');
    if (fs.existsSync(latestDir)) {
      fs.rmSync(latestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(latestDir, { recursive: true });

    // Track already-copied filenames to avoid double-copying
    const alreadyCopied = new Set<string>();

    // 1. Copy markdown report
    if (fs.existsSync(reportPath)) {
      const reportBasename = path.basename(reportPath);
      fs.copyFileSync(reportPath, path.join(latestDir, reportBasename));
      alreadyCopied.add(reportBasename);
    }

    // 2. Copy manifest JSON if present
    const manifestSrc = path.join(scenarioArtifactsDir, 'manifest.json');
    if (fs.existsSync(manifestSrc)) {
      fs.copyFileSync(manifestSrc, path.join(latestDir, 'manifest.json'));
      alreadyCopied.add('manifest.json');
    }

    // 3. Copy individual image snapshots
    for (const snap of snapshots) {
      if (snap.filePath && fs.existsSync(snap.filePath)) {
        fs.copyFileSync(snap.filePath, path.join(latestDir, snap.fileName));
        alreadyCopied.add(snap.fileName);
      }
    }

    // 4. Copy all remaining plugin-generated files (a11y-tree.md, *_diff.png, *.webm, etc.)
    //    that were not already copied in steps 1-3
    const allFiles = fs.readdirSync(scenarioArtifactsDir);
    for (const file of allFiles) {
      if (alreadyCopied.has(file)) continue;
      const src = path.join(scenarioArtifactsDir, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(latestDir, file));
      }
    }

    return path.join(latestDir, 'report.md');
  } catch {
    return undefined;
  }
}
