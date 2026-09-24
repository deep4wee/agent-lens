import fs from 'fs';
import path from 'path';
import type { SnapshotMetadata, VisualScenario } from '../../shared/api/dsl';
import type { ConsoleEntry } from '../../shared/types/console';
import type { ReportData } from '../../shared/types/report';

export type { ReportData };


export class VisualReporter {
  public static generateReport(data: ReportData): string {
    const {
      scenario,
      snapshots,
      consoleErrors,
      consoleWarnings,
      outputDir,
      targetMode,
      durationMs
    } = data;

    const manifestPath = path.join(outputDir, 'manifest.json');
    const reportPath = path.join(outputDir, 'report.md');

    const manifest = {
      scenarioId: scenario.id,
      title: scenario.title,
      description: scenario.description,
      targetMode,
      durationMs,
      totalSnapshots: snapshots.length,
      consoleErrors: consoleErrors.length,
      consoleWarnings: consoleWarnings.length,
      createdAt: new Date().toISOString(),
      snapshots,
      errors: consoleErrors,
      warnings: consoleWarnings
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    const rows: string[] = [];
    
    const regularSnapshots = snapshots.filter((s) => !s.isBurstFrame);
    const burstGroups = new Map<string, SnapshotMetadata[]>();

    snapshots.filter((s) => s.isBurstFrame && s.burstGroup).forEach((s) => {
      const list = burstGroups.get(s.burstGroup!) || [];
      list.push(s);
      burstGroups.set(s.burstGroup!, list);
    });

        for (const snap of regularSnapshots) {
      const relativeLink = snap.relativeUri || `./${snap.fileName}`;
      rows.push(
        `| **${String(snap.index).padStart(2, '0')}** | \`${snap.viewport.width}x${snap.viewport.height}\` | ${snap.name} | [${snap.fileName}](${relativeLink}) |`
      );
    }

    let burstSections = '';
    if (burstGroups.size > 0) {
      burstSections += `\n### 🎬 Animation Bursts\n\n`;
      for (const [group, frames] of burstGroups.entries()) {
        burstSections += `#### Animation: \`${group}\` (${frames.length} frames)\n\n`;
        burstSections += `| Frame | Viewport | File | Preview |\n| :--- | :--- | :--- | :--- |\n`;
        for (const frame of frames) {
          const relativeLink = frame.relativeUri || `./${frame.fileName}`;
          burstSections += `| Frame ${frame.frameIndex} | \`${frame.viewport.width}x${frame.viewport.height}\` | [${frame.fileName}](${relativeLink}) | ![](${relativeLink}) |\n`;
        }
        burstSections += `\n`;
      }
    }
        

    const healthStatus = this.getHealthStatus(consoleErrors, consoleWarnings);
    let consoleSections = '';

    if (consoleErrors.length > 0) {
      consoleSections += `\n## 🔴 Console Errors (${consoleErrors.length})\n\n`;
      consoleSections += `> [!CAUTION]\n> Found **${consoleErrors.length}** JavaScript errors during the test. This might indicate broken components, missing data, or unhandled exceptions.\n\n`;
      consoleSections += `| # | Time | Error | URL |\n| :-: | :--- | :--- | :--- |\n`;
      consoleErrors.forEach((err, i) => {
        const time = err.timestamp.split('T')[1]?.slice(0, 8) || '';
        const text = err.text.replace(/\|/g, '\\|').slice(0, 200);
        const url = err.url.replace(/\|/g, '\\|');
        consoleSections += `| ${i + 1} | \`${time}\` | ${text} | \`${url}\` |\n`;
      });

      const withStack = consoleErrors.filter(e => e.stack);
      if (withStack.length > 0) {
        consoleSections += `\n<details>\n<summary>📋 Stack Traces (${withStack.length})</summary>\n\n`;
        withStack.forEach((err, i) => {
          consoleSections += `**Error ${i + 1}:** \`${err.text.slice(0, 100)}\`\n\`\`\`\n${err.stack}\n\`\`\`\n\n`;
        });
        consoleSections += `</details>\n`;
      }
    }

    if (consoleWarnings.length > 0) {
      consoleSections += `\n## 🟡 Console Warnings (${consoleWarnings.length})\n\n`;
      consoleSections += `| # | Warning |\n| :-: | :--- |\n`;
      consoleWarnings.slice(0, 20).forEach((warn, i) => {
        const text = warn.text.replace(/\|/g, '\\|').slice(0, 200);
        consoleSections += `| ${i + 1} | ${text} |\n`;
      });
      if (consoleWarnings.length > 20) {
        consoleSections += `\n*...and ${consoleWarnings.length - 20} more warnings (full list in manifest.json)*\n`;
      }
    }

    let pluginSections = '';
    if (data.customSections && data.customSections.length > 0) {
      for (const sec of data.customSections) {
        pluginSections += `\n## ${sec.title}\n\n${sec.content}\n\n`;
      }
    }

    const reportContent = `# 📸 Visual Test Report: ${scenario.title}

> **Scenario ID:** \`${scenario.id}\`  
> **Target Mode:** \`${targetMode.toUpperCase()}\` (${targetMode === 'desktop' ? 'Native Desktop App / WebView2' : 'Fast Web Preview'})  
> **Execution Duration:** ${(durationMs / 1000).toFixed(2)} s  
> **Total Snapshots Captured:** ${snapshots.length}  
> **Health Status:** ${healthStatus}  
> **Artifacts Folder:** \`${outputDir}\`

---

## 🖼️ Primary Snapshot Overview

| # | Viewport | Step Description | File Reference |
| :-: | :--- | :--- | :--- |
${rows.join('\n')}

${burstSections}
${consoleSections}
${pluginSections}
---

## 📋 AI Agent Verification Checklist:
- [ ] **Console Errors**: ${consoleErrors.length === 0 ? '✅ No errors found' : `❌ ${consoleErrors.length} errors — MUST REVIEW`}
- [ ] **Visual Layout Check**: Inspect snapshots (e.g. view_image on \`./01_${regularSnapshots[0]?.fileName || 'quick_snap'}\`) for layout shifts or clipped elements.
- [ ] **Responsiveness at \`1024x768\`**: Elements do not overflow the screen, no unwanted horizontal scroll.
        
- [ ] **Typography & Spacing**: Spacing matches the design system and layout grids.
- [ ] **Color Palette & Theme**: Background tints and button accent colors match the concept.
- [ ] **Component States**: Modals open centered, dropdowns do not overlap with other layers (z-index).
- [ ] **Localization**: Verify that there are no raw i18n keys (text with dots like \`sidebar.home\` instead of "Home").

`;

    fs.writeFileSync(reportPath, reportContent, 'utf-8');
    return reportPath;
  }

  private static getHealthStatus(errors: ConsoleEntry[], warnings: ConsoleEntry[]): string {
    if (errors.length === 0 && warnings.length === 0) {
      return '✅ Healthy — no errors or warnings';
    }
    if (errors.length === 0 && warnings.length > 0) {
      return `⚠️ Warnings (${warnings.length}) — no critical errors`;
    }
    return `❌ ERRORS (${errors.length} errors, ${warnings.length} warnings) — requires attention`;
  }
}
