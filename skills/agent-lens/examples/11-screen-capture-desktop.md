# Example 11: OS-Level Screen Capture for Desktop Apps

## When to Use This

> [!CAUTION]
> The `screen-capture` plugin captures the **entire physical screen** or the active window
> at the OS level. This is fundamentally different from CDP-based capture.
>
> **Only use this plugin when all the following are true:**
> 1. ✅ You are in `--mode=desktop` testing a compiled `.exe` app
> 2. ✅ The machine shows **only** the test application on screen
> 3. ✅ No sensitive windows (email, browser, banking, passwords) are visible
> 4. ✅ You are NOT running in a shared or multi-user environment
> 5. ✅ You are NOT in CI/CD without a real physical display

### Why it exists

The `desktop-webview2` plugin connects via CDP to see **inside** the WebView2 window.
It cannot see:
- Native system dialogs (Open File, Save As, Permission requests)
- Splash screens before the WebView loads
- Native titlebars, window borders, taskbar notifications
- System tray popups or OS overlays
- Anything that appears **outside** the WebView content area

`screen-capture` fills this gap.

---

## Safety Checklist (Agent Must Verify BEFORE Running)

```
BEFORE using screen-capture, the agent must verify:

□ --mode=desktop is set
□ The test machine / VM has ONLY the test app visible on screen
□ No browser, email client, IDE, or other app with visible content is open
□ Not running in a shared CI environment
□ The user has been informed that the full screen will be captured
```

If any box is unchecked — use `ctx.capture()` (CDP-based) instead.

---

## Setup

```bash
# Always use with desktop mode
npx agent-lens --scenario=my-app --mode=desktop --exe=./MyApp.exe --plugin=screen-capture,desktop-webview2
```

Or in `defineVisualTest`:
```typescript
export default defineVisualTest({
  id: 'native-dialog-flow',
  title: 'Native File Open Dialog Test',
  plugins: ['desktop-webview2', 'screen-capture'],  // screen-capture AFTER desktop-webview2
  // ...
});
```

---

## Available Methods (Added to ctx)

| Method | Description |
|:-------|:------------|
| `ctx.captureScreen(name?)` | Captures entire primary display — **most dangerous** |
| `ctx.captureActiveWindow(name?)` | Captures only the active (foreground) window |
| `ctx.clickScreenAt(x, y, options?)` | OS-level click at absolute screen coordinates |
| `ctx.pressOsKey(key)` | Sends OS-level key press to the active window |

---

## Example: Native File Dialog

```typescript
import { defineVisualTest } from 'agent-lens';

export default defineVisualTest({
  id: 'native-file-dialog',
  title: 'Verify File Open Dialog Appears Correctly',
  plugins: ['desktop-webview2', 'screen-capture'],
  run: async (ctx) => {
    // 1. Take initial screenshot using CDP (safe, inside WebView)
    await ctx.capture('01_initial_state');

    // 2. Click "Open File" button inside the app via CDP
    await ctx.click('button#open-file');
    await ctx.wait(800); // Wait for native dialog to appear

    // 3. Native dialog is OUTSIDE WebView — capture it at OS level
    // ⚠️ Ensure no other apps are visible!
    await (ctx as any).captureScreen('02_native_file_dialog');

    // 4. Send Escape to close the dialog via OS key
    await (ctx as any).pressOsKey('Escape');
    await ctx.wait(300);

    // 5. Back to CDP for the rest
    await ctx.capture('03_after_dialog_close');
  }
});
```

---

## Example: Click on a Native UI Element Outside WebView

```typescript
run: async (ctx) => {
  // ... setup ...

  // Trigger something that shows a native titlebar button or system tray icon
  await ctx.click('button.minimize-app');
  await ctx.wait(500);

  // The app window moved — capture at screen level
  await (ctx as any).captureActiveWindow('02_minimized_state');

  // Restore by clicking the taskbar (OS-level absolute coordinates)
  // ⚠️ These coordinates depend on the EXACT screen resolution and taskbar position
  // They must be calibrated for the specific test machine!
  await (ctx as any).clickScreenAt(960, 1060); // Example: taskbar center on 1920x1080
  await ctx.wait(500);

  await (ctx as any).captureActiveWindow('03_restored_state');
}
```

> [!WARNING]
> Hardcoded screen coordinates (`clickScreenAt`) are **machine-specific**. They will fail
> on different resolutions or DPI settings. Document them clearly and only use when CDP
> interaction is genuinely impossible.

---

## What Happens at Runtime

```
🖥️ [screen-capture] Initialized in desktop mode.
⚠️  REMINDER: Ensure only the test application is visible on screen.

...

⚠️ [screen-capture] OS-LEVEL CLICK: These are PHYSICAL screen coordinates.
   They are NOT relative to the browser window. Ensure the target window
   is focused and in the foreground.
🖱️ [screen-capture] OS click at screen coords: (960, 540) [left×1]
```

---

## Alternatives (Prefer These When Possible)

| Situation | Use instead |
|:----------|:------------|
| Capture browser content | `ctx.capture()` (CDP, safe, exact) |
| Capture specific component | `ctx.capture(name, { selector: '.element' })` |
| Scroll and capture full page | `ctx.capture(name, { fullPage: true })` |
| Click a UI element | `ctx.click('selector')` (CDP-based) |
| Click by coordinates in WebView | `ctx.clickCoords(x, y)` (live-controller) |
| Need native capture only once | Consider a manual screenshot instead |
