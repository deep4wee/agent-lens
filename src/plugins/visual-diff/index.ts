import path from 'path';
import { definePlugin, type AgentLensPlugin } from '../../shared/api/plugin';
import { comparePngImages, type VisualDiffOptions, type VisualDiffResult } from './diff';
import type { CaptureOptions } from '../../shared/api/dsl';

export { comparePngImages, type VisualDiffOptions, type VisualDiffResult };

const STATE_DIFFS_KEY = 'recordedVisualDiffs';

export interface RecordedDiffEntry {
  name: string;
  baselinePath: string;
  currentPath: string;
  diffPath: string;
  result: VisualDiffResult;
}

export const visualDiffPlugin: AgentLensPlugin = definePlugin({
  name: 'visual-diff',
  version: '1.0.0',

  setup: (hookContext) => {
    hookContext.state.set(STATE_DIFFS_KEY, [] as RecordedDiffEntry[]);
  },

  extendContext: (ctx, page, hookContext) => {
    const diffRecords = (hookContext.state.get(STATE_DIFFS_KEY) as RecordedDiffEntry[]) || [];

    return {
      compareSnapshots: async (
        currentPath: string,
        baselinePath: string,
        options?: VisualDiffOptions
      ): Promise<VisualDiffResult> => {
        const artifactsDir = hookContext.artifactsDir;
        const baseName = path.basename(currentPath, '.png');
        const diffFileName = `${baseName}_diff.png`;
        const diffPath = path.join(artifactsDir, diffFileName);

        console.log(`🎨 [visual-diff] Comparing ${path.basename(currentPath)} against baseline...`);
        const result = await comparePngImages(baselinePath, currentPath, diffPath, options);

        console.log(
          `🎨 [visual-diff] Result: ${result.diffPixels} px changed (${result.diffPercent}%) | Diff: ${diffFileName}`
        );

        diffRecords.push({
          name: baseName,
          baselinePath,
          currentPath,
          diffPath,
          result
        });

        return result;
      },

      captureAndCompare: async (
        name: string,
        baselinePath: string,
        captureOptions?: CaptureOptions,
        diffOptions?: VisualDiffOptions
      ): Promise<VisualDiffResult> => {
        const snap = await ctx.capture(name, captureOptions);
        return await ctx.compareSnapshots(snap.filePath, baselinePath, diffOptions);
      }
    };
  },

  onAfterRun: (reportData, hookContext) => {
    const diffs = (hookContext.state.get(STATE_DIFFS_KEY) as RecordedDiffEntry[]) || [];
    if (diffs.length === 0 || !reportData.customSections) return;

    let table = `| Test Step | Baseline | Current | Diff Image | Changed Pixels | Status |\n`;
    table += `| :--- | :--- | :--- | :--- | :-: | :-: |\n`;

    for (const d of diffs) {
      const relBaseline = path.relative(reportData.outputDir, d.baselinePath).replace(/\\/g, '/');
      const relCurrent = path.relative(reportData.outputDir, d.currentPath).replace(/\\/g, '/');
      const relDiff = path.relative(reportData.outputDir, d.diffPath).replace(/\\/g, '/');

      const status = d.result.diffPercent === 0
        ? '✅ Perfect Match'
        : d.result.diffPercent < 1.0
        ? `🟡 Minor Shift (${d.result.diffPercent}%)`
        : `🔴 Regressed (${d.result.diffPercent}%)`;

      table += `| **${d.name}** | [Baseline](${relBaseline}) | [Current](${relCurrent}) | [Diff](${relDiff}) | ${d.result.diffPixels} px | ${status} |\n`;
    }

    reportData.customSections.push({
      title: '🎨 Visual Regression Diff (Pixelmatch)',
      content: `> Automated pixel-by-pixel visual difference detector.\n\n${table}`
    });
  }
});

export default visualDiffPlugin;
