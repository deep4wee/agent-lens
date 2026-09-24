import fs from 'fs';
import path from 'path';
import type { SnapshotMetadata } from '../../../shared/api/dsl';

/**
 * Synchronizes the generated test report and snapshots into artifacts/latest/
 * so agents always have immediate access to the freshest results without parsing timestamps.
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

    // 1. Copy markdown report
    if (fs.existsSync(reportPath)) {
      fs.copyFileSync(reportPath, path.join(latestDir, 'report.md'));
    }

    // 2. Copy manifest JSON if present
    const manifestSrc = path.join(scenarioArtifactsDir, 'manifest.json');
    if (fs.existsSync(manifestSrc)) {
      fs.copyFileSync(manifestSrc, path.join(latestDir, 'manifest.json'));
    }

    // 3. Copy individual image snapshots
    for (const snap of snapshots) {
      if (snap.filePath && fs.existsSync(snap.filePath)) {
        fs.copyFileSync(snap.filePath, path.join(latestDir, snap.fileName));
      }
    }

    return path.join(latestDir, 'report.md');
  } catch {
    return undefined;
  }
}
