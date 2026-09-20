# Example 4: Native Desktop Application Testing (.exe / WebView2 / Electron)

Test real compiled native desktop binaries in production conditions, interacting with the real backend and rendering engine over Chrome DevTools Protocol (CDP).

## Use Cases
- Verifying desktop applications (Photino .NET, Electron, Tauri, WPF WebView2).
- Testing real system interactions, filesystem writes, and native process IPC.
- Verifying the app builds and boots up cleanly without missing DLLs or native crashes.

## 1. Writing the Scenario (`scenarios/desktop-app.scenario.ts`)

```typescript
import { defineVisualTest, VIEWPORT_PRESETS } from 'agent-lens';
import fs from 'fs';
import path from 'path';

export default defineVisualTest({
  id: 'desktop-smoke-test',
  title: 'Native Desktop Application Production Verification',
  run: async (ctx) => {
    ctx.log('1. Waiting for native backend and UI initialization');
    await ctx.wait(2500);

    // Initial desktop screenshot
    await ctx.setPreset(VIEWPORT_PRESETS.DEFAULT);
    await ctx.capture('01_desktop_main_window');

    // Test minimal window size constraints
    await ctx.setPreset(VIEWPORT_PRESETS.MIN_SUPPORTED);
    await ctx.capture('02_desktop_min_window');
    await ctx.setPreset(VIEWPORT_PRESETS.DEFAULT);

    // Click native action button that triggers backend work
    ctx.log('2. Triggering native save action');
    await ctx.click('button#save-preferences');
    await ctx.wait(500);
    await ctx.capture('03_saved_state');

    // Verify file written to disk by real native backend
    const savedConfig = path.resolve(process.cwd(), 'config', 'user-prefs.json');
    if (fs.existsSync(savedConfig)) {
      ctx.log('✅ Real backend successfully created config file on disk!');
    } else {
      ctx.log('⚠️ Config file was not written to disk.');
    }
  }
});
```

## 2. Running with Automated Build and Binary Launch

```bash
npx agent-lens \
  --scenario=desktop-smoke-test \
  --mode=desktop \
  --build="dotnet build -c Release" \
  --exe="bin/Release/net8.0-windows/MyApp.exe" \
  --port=9222 \
  --folder=visual-reports
```

### How AgentLens Handles Native Apps:
1. Runs the specified build command (`--build`).
2. Spawns `MyApp.exe` with remote debugging flags.
3. If the executable crashes on launch (e.g. missing runtime, segfault), AgentLens immediately catches the exit code and stderr, printing the exact crash log.
4. Once the CDP port is listening, Playwright attaches directly to the native window.
5. Runs the test and takes snapshots.
6. Gracefully terminates the process tree on completion.
