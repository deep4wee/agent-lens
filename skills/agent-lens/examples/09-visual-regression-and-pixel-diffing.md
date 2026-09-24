# 🎨 Example 09: Visual Regression & Pixel Diffing

The **`visual-diff`** plugin adds automated, pixel-by-pixel regression testing using `pixelmatch` and `pngjs`. It detects unintended visual shifts, color alterations, font changes, and layout regressions down to individual pixels.

---

## 🎯 Use Case

You are refactoring CSS styles or upgrading a component library (e.g. Tailwind, Shadcn, MUI) and need to guarantee that the UI did not unintentionally change from a known baseline.

---

## 🛠️ Step-by-Step Walkthrough

### 1. Establish Baseline Screenshots
Run your scenario once to generate reference screenshots, and commit them to a baseline directory (e.g. `fixtures/baselines/`):
```bash
mkdir -p fixtures/baselines
cp artifacts/latest/01_homepage_default.png fixtures/baselines/homepage_baseline.png
```

---

### 2. Write Scenario with Visual Diffing

```typescript
import path from 'path';
import { defineVisualTest } from 'agent-lens';
import visualDiffPlugin from '@_deep4wee/agent-lens/plugins/visual-diff';

export default defineVisualTest({
  id: 'homepage-regression',
  title: 'Homepage Visual Regression Check',
  plugins: [visualDiffPlugin],
  run: async (ctx) => {
    const baselinePath = path.resolve(process.cwd(), 'fixtures/baselines/homepage_baseline.png');

    // Capture current view and compare against baseline in a single step:
    const diff = await (ctx as any).captureAndCompare(
      '01_homepage_check',
      baselinePath,
      { fullPage: false },
      { threshold: 0.1 } // Sensitivity threshold (0 to 1, default 0.1)
    );

    ctx.log(`Diff result: ${diff.diffPixels} pixels (${diff.diffPercent}%)`);

    // Strict assertion: Fail if more than 0.5% of pixels changed
    if (diff.diffPercent > 0.5) {
      throw new Error(`Visual regression detected! Diff is ${diff.diffPercent}% (${diff.diffPixels} px).`);
    }
  }
});
```

---

### 3. Inspecting the Report

When the scenario runs, `visual-diff` generates:
- `artifacts/<timestamp>/01_homepage_check_diff.png` (visual difference mask in bright red)
- A comparison table in `artifacts/latest/report.md`:

| Test Step | Baseline | Current | Diff Image | Changed Pixels | Status |
| :--- | :--- | :--- | :--- | :-: | :-: |
| **01_homepage_check** | [Baseline](fixtures/baselines/homepage_baseline.png) | [Current](01_homepage_check.png) | [Diff](01_homepage_check_diff.png) | 48 px | 🟡 Minor Shift (0.04%) |
