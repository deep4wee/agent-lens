---
name: agent-lens
description: Visual UI self-verification tool for AI agents. Take responsive multi-viewport snapshots of live URLs or run scripted interaction scenarios in Chromium or native desktop WebView2. Catches visual regressions, layout shifts, silent console errors, and runtime exceptions.
---

# 👁️ AgentLens

**AgentLens** is a visual self-verification tool designed specifically for autonomous AI coding agents.

Instead of writing frontend code and blindly guessing if it looks right, AgentLens gives you **eyes**. You can capture multi-viewport screenshots of your running app, focus on isolated components, test animations, intercept silent JavaScript errors, and inspect the resulting markdown report to iterate autonomously before showing the final result to the user.

---

## ⚡ Two Modes of Agent Verification

### 1. Instant Verification (`snap`) — No test files needed!
Ideal for 90% of tasks when you just modified a page, component, or layout:
```bash
# Verify a live dev server across desktop & mobile viewports:
npx agent-lens snap --url=http://localhost:5173

# Auto-start dev server in a monorepo (e.g. Frontend/), snap, and auto-terminate:
npx agent-lens snap --start="npm run dev" --start-cwd=./Frontend

# Zero-config smart snap (auto-detects active server or static build):
npx agent-lens snap

# Focus strictly on one component:
npx agent-lens snap --url=http://localhost:5173/settings --selector=".pricing-card"
```

### 2. Scripted Scenarios (`npx agent-lens --scenario=<name>`)
For multi-step flows, form submissions, state mocks, and complex assertions:
```bash
npx agent-lens --scenario=checkout-flow --url=http://localhost:5173
```

---

## 🧭 The Agent Workflow

1. **Write or Edit the Code**: Implement the requested UI changes or components.
2. **Choose Your Verification Method**:
   - **Quick check**: Run `npx agent-lens snap`.
   - **Interactive check**: Write a scenario file in `scenarios/<name>.scenario.ts`.
3. **Execute the Runner**:
   ```bash
   npx agent-lens snap --url=http://localhost:5173
   ```
4. **Inspect the Output**:
   - AgentLens always synchronizes the most recent run to:
     `artifacts/latest/report.md`
   - **Step 1 (Check Logs & Console)**: Use your file reading tool (`view_file`, `cat`) on `artifacts/latest/report.md`. If there are any **Console Errors**, fix the JavaScript / React exceptions first.
   - **Step 2 (Vision Visual Check)**: If your environment supports multimodal / vision tools (e.g. `view_image`), inspect the latest generated screenshots directly:
     `artifacts/latest/01_quick_snap_desktop.png`
     `artifacts/latest/02_quick_snap_mobile.png`
     Look for text overflow, unwanted horizontal scrolling, broken CSS flex/grid layouts, or misaligned elements.
5. **Self-Correct & Iterate**: Re-run verification until the layout is visually solid and the console is clean.
        

---

## ⚠️ Agent Best Practices & Pitfalls to Avoid

### 1. Avoid Localized Text in Selectors (Localization Pitfall)
❌ **Never write:**
```typescript
await ctx.type('input[placeholder*="Search"]', 'text'); // Fails if language is Ukrainian "Пошук"!
await ctx.click('button:has-text("Save")');            // Fails on non-English UI!
```
✅ **Always use semantic attributes, test IDs, or structural CSS:**
```typescript
await ctx.type('input[type="search"]', 'text');
await ctx.type('input[name="query"]', 'text');
await ctx.click('button[type="submit"]');
await ctx.click('[data-testid="save-button"]');
```

### 2. Base Mocks in `scenarios/mocks.ts` (Prevent Root Crashes)
When your app mounts, the root component (Navbar, AuthContext, Layout) often queries base endpoints (e.g. `GET_USER`, `GET_SETTINGS`, `GET_ACCOUNTS`). If your scenario only mocks one sub-action, unmocked root actions may return empty and crash the app with `Cannot read properties of null (reading 'length')`.
- Place common base mocks in `scenarios/mocks.ts`.
- AgentLens automatically merges `scenarios/mocks.ts` with your scenario's specific `mockIpc: [...]` overrides!

### 3. Monorepos & Subdirectories (`--start-cwd`)
If your frontend lives in a subfolder like `Frontend/` or `client/`:
- Pass `--start-cwd=./Frontend` (or configure `"startCwd": "./Frontend"` in `agent-lens.json`).
- AgentLens automatically auto-detects `Frontend/`, `client/`, or `web/` if root `package.json` lacks a `dev` script.

### 4. Preventing Artifact Folder Bloat
To keep the workspace tidy across multiple test iterations, use:
```bash
npx agent-lens snap --clean-artifacts
```
Or always inspect the single persistent pointer:
`artifacts/latest/report.md`

---

## 💻 CLI Flags & Options

```bash
npx agent-lens [command] [options]
```

### Commands:
- `snap`: Instant one-shot snapshot & console check of a URL or static build.
- `init`: Generate starter template in `scenarios/template.scenario.ts` and `scenarios/mocks.ts`.
- *(default)*: Runs matching scenarios from `scenarios/`.

### Options:
| Flag | Description | Default |
| :--- | :--- | :--- |
| `--url=<url>` | Target URL to test (e.g. `http://localhost:5173`) | *Auto-detected* |
| `--start="<cmd>"` | Auto-launch dev server / backend before test | *(none)* |
| `--start-cwd=<path>` | Directory to run `--start` in (e.g. `--start-cwd=./Frontend`) | *Auto-detected* |
| `--clean-artifacts` | Purge older test runs in `artifacts/` | `false` |
| `--selector=<css>` | Focus and resize-to-fit a specific component | *(none)* |
| `--viewports=<list>` | Viewports to capture (`desktop,mobile,tablet` or `1200x800`) | `desktop,mobile` |
| `--wait=<ms>` | Wait time after page load before taking snapshots | `1000` |
| `--scenario=<id>` | Name or prefix of scenario file to run | *(none)* |
| `--all` | Run all discovered scenarios | `false` |
| `--mode=preview\|desktop` | Engine: `preview` (Web / Live URL) or `desktop` (native .exe) | `preview` |
| `--exe=<path>` | Path to compiled desktop executable for desktop mode | *(none)* |
| `--port=<port>` | CDP remote debugging port for desktop mode | `9222` |
| `--build[=<cmd>]` | Build command to run before testing | `npm run build` |
| `--clean=<paths>` | Comma-separated paths to purge on exit | *(none)* |
| `--folder=<path>` | Folder to store report & screenshots (also `--outDir`) | `artifacts` |
| `--headed` | Open visible browser window | `false` |
| `--detach` | Do not close browser or app on finish | `false` |

---

## 🛠️ DSL API Reference (`scenarios/*.scenario.ts`)

```typescript
import { defineVisualTest, VIEWPORT_PRESETS, type TestContext } from 'agent-lens';
```

### Scenario Definition Structure:
```typescript
export default defineVisualTest({
  id: 'my-feature-check',
  title: 'Feature Verification',
  route: '/dashboard', // Route or URL
  viewports: [VIEWPORT_PRESETS.DEFAULT, VIEWPORT_PRESETS.MIN_SUPPORTED],

  // HTTP REST / GraphQL Network Mocks (Vite / Next.js / Web SPA)
  mockRoutes: [
    { url: '**/api/v1/user', body: { id: 1, name: 'Agent', role: 'admin' } },
    { url: '**/api/v1/stats', body: { total: 42, active: 10 } }
  ],

  // Optional Hybrid / IPC mocks
  mockIpc: [
    { action: 'GET_PREFS', data: { theme: 'dark' } }
  ],
  
  // Lifecycle Setup: prepare temporary state or mock folders
  setup: async () => {},

  // Test Body: interact and capture
  run: async (ctx) => {},

  // Lifecycle Teardown: ALWAYS executes, guaranteed cleanup
  teardown: async () => {}
});
```
        

### Available `ctx` Methods:

#### 📸 Capturing
- `await ctx.capture('01_name', options?)`: Capture full page or element snapshot.
- `await ctx.captureBurst('02_anim', { durationMs: 300, intervalMs: 50, selector? })`: Capture animation frames.

#### 📐 Viewport Control
- `await ctx.setPreset(VIEWPORT_PRESETS.DEFAULT)`: Standard desktop (1200x800).
- `await ctx.setPreset(VIEWPORT_PRESETS.MIN_SUPPORTED)`: Compact viewport (1024x768).
- `await ctx.setPreset(VIEWPORT_PRESETS.WIDE)`: Widescreen (1600x900).
- `await ctx.resize(width, height)`: Custom dimensions.
- `await ctx.resizeToFit('selector', padding?)`: Dynamically resize viewport to wrap an element tightly.

#### 🖱️ Interactions
- `await ctx.click('selector')` / `await ctx.rightClick('selector')`
- `await ctx.type('selector', 'text')`
- `await ctx.selectOption('selector', 'value')`
- `await ctx.hover('selector')`
- `await ctx.scroll('selector', deltaY)`

#### 🕒 Waiting & Assertions
- `await ctx.wait(ms)`
- `await ctx.waitForSelector('selector', timeoutMs?)`
- `const text = await ctx.readText('selector')`
- `const pageText = await ctx.getPageText()`
- `const isVisible = await ctx.isVisible('selector')`
- `const count = await ctx.getElementCount('selector')`

#### 🐛 Console & Logs
- `ctx.log('Message')`: Writes custom log entry into the final markdown report.
- `ctx.getConsoleErrors()`: Array of caught errors with stack traces.
- `ctx.getConsoleWarnings()`: Array of caught warnings.

#### 🌐 Network Route & Mock IPC (Preview mode)
- `await ctx.setMockRoute('**/api/users', payload, options?)`: Dynamically intercepts HTTP/REST API endpoints and returns mock JSON or status codes.
- `await ctx.setMockIpc('ACTION_NAME', payload, { type: 'SUCCESS' | 'ERROR', delayMs?: number })`: Dynamically alters mock data for hybrid IPC bridges.
        

---

## 📚 Detailed Examples & Use Cases

Check the dedicated example guides in `examples/` for complete walk-throughs:
1. [Instant Verification (`snap`)](examples/01-instant-verification-snap.md) — One-shot snapshotting without writing test files.
2. [Live Dev Server Workflow](examples/02-dev-server-live-testing.md) — Testing active Vite/Next.js servers with `--start` or `--url`.
3. [Component Isolation & Burst Animations](examples/03-component-isolation-and-animations.md) — Inspecting isolated components and CSS transitions.
4. [Native Desktop App Testing](examples/04-desktop-native-testing.md) — Testing compiled `.exe` binaries with CDP and crash diagnostics.
5. [Clean Teardown & Sandboxing](examples/05-clean-teardown-and-sandboxing.md) — Guaranteeing zero leftover test data using `teardown()` and `--clean`.
6. [State Testing with Mock IPC](examples/06-state-testing-with-mock-ipc.md) — Testing empty states, errors, and data tables.
