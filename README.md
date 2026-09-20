<div align="center">
  <h1>👁️ AgentLens</h1>
  <p><b>Give your AI coding agent eyes.</b></p>
  <p>Visual self-check, responsive layout verification, and console crash detection before reporting back to humans.</p>

  [![npm version](https://img.shields.io/npm/v/@_deep4wee/agent-lens.svg?color=blue)](https://www.npmjs.com/package/@_deep4wee/agent-lens)
  [![npm downloads](https://img.shields.io/npm/dm/@_deep4wee/agent-lens.svg)](https://www.npmjs.com/package/@_deep4wee/agent-lens)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/deep4wee/agent-lens/blob/main/LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
  [![Playwright](https://img.shields.io/badge/Powered%20By-Playwright-orange.svg)](https://playwright.dev/)
</div>

---

## 🤔 The Problem

AI coding agents (like Cursor, Claude Code, Gemini CLI, or Roo) are great at writing code, but they are **blind**. 

When an agent builds a UI, it reports *"Done!"*, but it doesn't know if:
- The CSS layout shifted or broke on mobile viewports.
- The modal opened off-screen or clips behind another layer.
- An unhandled JavaScript error or `undefined` prop just crashed the React tree.

Humans are forced to manually open the browser, take screenshots, and tell the agent what to fix.

## 💡 The Solution

**AgentLens** is a visual testing harness built specifically for AI coding agents. It allows the agent to:
1. Write the frontend or desktop code.
2. **"See" the result immediately** using a one-shot `snap` command or scripted scenarios.
3. Catch silent console crashes, missing assets, and runtime errors.
4. Auto-clean temporary test files and cache so no corrupted state is left behind.
5. Fix its own mistakes *before* presenting the final result to the user!

---

## ✨ Features

- ⚡ **Instant One-Shot Verification (`snap`)**: Verify any live URL across desktop and mobile in seconds without writing test files.
- 🚀 **Managed Process Lifecycle**: Auto-launch dev servers (`--start="npm run dev"`), wait for the port, run tests, and cleanly shut down the process tree.
- 📸 **Multi-Viewport Snapshots**: Test Desktop, Tablet, Mobile, and Widescreen layouts simultaneously.
- 📏 **Dynamic Auto-Resize (`resizeToFit`)**: Automatically fit the browser viewport tightly around any component to inspect it in isolation.
- 🎬 **Burst Animations**: Capture frame-by-frame sequences of hover states, transitions, and dropdown menus.
- 🔴 **Console Crash Tracker**: Automatically intercepts `console.error`, `console.warn`, and unhandled exceptions (`pageerror`) with stack traces.
- 🖥️ **Native Desktop Testing**: Test compiled `.exe` binaries (WebView2 / Electron / .NET) over Chrome DevTools Protocol (CDP) with startup crash diagnostics.
- 🧹 **Guaranteed Clean Teardown**: Built-in `setup()`, `teardown()`, and `--clean` flags that execute in a `finally` block even if the test fails.
- 🤖 **Agent-First Markdown Reports**: Generates a clean `report.md` formatted for LLM reading tools, complete with checklists and embedded screenshot links.

---

## 🚀 Quickstart

### 1. Instant One-Shot Check (`snap`)

The fastest way to verify changes without writing any test files:

```bash
# Run directly via npx:
npx @_deep4wee/agent-lens snap --url=http://localhost:5173

# Auto-start dev server, wait until ready, snap, and auto-terminate:
npx @_deep4wee/agent-lens snap --start="npm run dev" --url=http://localhost:5173

# Focus on a specific component:
npx @_deep4wee/agent-lens snap --url=http://localhost:5173/settings --selector=".pricing-card"
```

### 2. Scripted Scenarios

Install as a development dependency:
```bash
npm install -D @_deep4wee/agent-lens
```

Initialize starter scenario:
```bash
npx agent-lens init
```

Run a scenario:
```bash
npx agent-lens --scenario=smoke --url=http://localhost:5173
```

---

## 🛠️ API Reference (Scenario DSL)

Write scenarios in `scenarios/<name>.scenario.ts`:

```typescript
import { defineVisualTest, VIEWPORT_PRESETS, type TestContext } from 'agent-lens';

export default defineVisualTest({
  id: 'checkout-flow',
  title: 'Checkout Flow Verification',
  route: '/checkout',
  viewports: [VIEWPORT_PRESETS.DEFAULT, VIEWPORT_PRESETS.MIN_SUPPORTED],

  // 1. Setup: Prepare clean test environment
  setup: async () => {
    // fs.mkdirSync('./tmp_test_data', { recursive: true });
  },

  // 2. Main Test Execution
  run: async (ctx: TestContext) => {
    // --- Navigation & Viewport ---
    await ctx.setPreset(VIEWPORT_PRESETS.DEFAULT);
    await ctx.capture('01_checkout_initial');

    // --- Interaction ---
    await ctx.type('input[name="coupon"]', 'DISCOUNT2026');
    await ctx.click('button.apply-coupon');
    await ctx.wait(500);

    // --- Component Isolation ---
    await ctx.resizeToFit('.cart-summary', 15);
    await ctx.capture('02_cart_summary_fitted');

    // --- Assertions & DOM Inspection ---
    const totalText = await ctx.readText('.total-amount');
    ctx.log(`Verified total amount: ${totalText}`);

    // --- Check Console Errors ---
    const errors = ctx.getConsoleErrors();
    if (errors.length > 0) {
      ctx.log(`🚨 UI errors detected: ${errors.length}`);
    }
  },

  // 3. Teardown: Guaranteed to execute even if run() crashes!
  teardown: async () => {
    // fs.rmSync('./tmp_test_data', { recursive: true, force: true });
  }
});
```

---

## 💻 CLI Flags Reference

```bash
npx agent-lens [command] [options]
```

| Flag | Description | Default |
| :--- | :--- | :--- |
| `snap` | Subcommand: Instant one-shot verification of a URL | — |
| `init` | Subcommand: Scaffold a starter `template.scenario.ts` | — |
| `--url=<url>` | Target URL to test (live dev server or preview) | *Auto-detected* |
| `--start="<cmd>"` | Command to launch dev server/backend before test | — |
| `--start-cwd=<path>` | Directory to run `--start` in (e.g. `--start-cwd=./Frontend`) | *Auto-detected* |
| `--clean-artifacts` | Purge previous test runs in `artifacts/` | `false` |
| `--selector=<css>` | Component selector to focus on / resize-to-fit | — |
| `--viewports=<list>`| Viewport presets (`desktop,mobile,tablet` or `1200x800`) | `desktop,mobile` |
| `--wait=<ms>` | Milliseconds to wait after page load before capture | `1000` |
| `--scenario=<id>` | Name or prefix of scenario file to run | — |
| `--all` | Run all discovered scenarios | `false` |
| `--mode=<mode>` | Engine mode: `preview` (Web/Live) or `desktop` (native .exe) | `preview` |
| `--exe=<path>` | Path to compiled desktop executable for desktop mode | — |
| `--port=<port>` | CDP remote debugging port for desktop mode | `9222` |
| `--build[=<cmd>]` | Build command to run before testing | `npm run build` |
| `--clean=<paths>` | Comma-separated paths to purge upon test completion | — |
| `--folder=<path>` | Folder to store artifacts and reports (also `--outDir`) | `artifacts` |
| `--headed` | Show Chromium browser window (for human debugging) | `false` |
| `--detach` | Do not close browser or app after tests finish | `false` |

> 💡 **Tip for AI Agents:** AgentLens always maintains a persistent copy of the most recent report at `artifacts/latest/report.md`. You can inspect this file directly without needing to compute or match timestamped directory names.

---

## ⚙️ Configuration (`agent-lens.json`)

You can define options globally in an `agent-lens.json` file in your repository root:

```json
{
  "url": "http://localhost:5173",
  "startCommand": "npm run dev",
  "scenarios": "scenarios",
  "outDir": "visual-reports",
  "clean": ["./cache", "./tmp_test_data"],
  "autoBuild": false
}
```

Or under the `"agentLens"` property in your `package.json`:

```json
{
  "agentLens": {
    "url": "http://localhost:3000",
    "scenarios": "tests/visual"
  }
}
```

---

## 🧠 Equipping AI Agents (`SKILL.md`)

When installed via NPM, AgentLens automatically copies the agent skill into your project's `.agents/skills/agent-lens/` folder. This equips agents (like Cursor, Gemini, Claude, and Roo) with the exact system instructions and example workflows needed to use AgentLens autonomously.

Check the `skills/agent-lens/examples/` directory for detailed walkthroughs:
- **[01-instant-verification-snap.md](skills/agent-lens/examples/01-instant-verification-snap.md)**: Zero-config quick checks.
- **[02-dev-server-live-testing.md](skills/agent-lens/examples/02-dev-server-live-testing.md)**: Live dev server workflows.
- **[03-component-isolation-and-animations.md](skills/agent-lens/examples/03-component-isolation-and-animations.md)**: Deep component and animation testing.
- **[04-desktop-native-testing.md](skills/agent-lens/examples/04-desktop-native-testing.md)**: Native `.exe` and WebView2 testing.
- **[05-clean-teardown-and-sandboxing.md](skills/agent-lens/examples/05-clean-teardown-and-sandboxing.md)**: Preventing leftover test data.
- **[06-state-testing-with-mock-ipc.md](skills/agent-lens/examples/06-state-testing-with-mock-ipc.md)**: Empty states and error handling.

---

## 📄 License & Disclaimer
 
 Released under the [MIT License](https://github.com/deep4wee/agent-lens/blob/main/LICENSE). Free for open-source and commercial use.
 
 > [!NOTE]
 > **Autonomous Agent Usage Disclaimer**: AgentLens is designed to execute commands, launch local dev servers, and interact with web browsers or desktop binaries as instructed by scripts or AI agents. The author and contributors assume no liability for any unintentional file modifications, port conflicts, process terminations, or data loss caused by autonomous agent actions or third-party code tested with this tool. Run agents and test scripts in appropriate development environments or containers.
 
 Copyright © 2026 [deep4wee](https://github.com/deep4wee).
