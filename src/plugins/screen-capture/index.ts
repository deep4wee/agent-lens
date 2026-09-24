import path from 'path';
import { definePlugin, type AgentLensPlugin } from '../../shared/api/plugin';
import {
  captureScreen,
  osClick,
  osKeyPress,
  type OsClickOptions
} from './osActions';

export { captureScreen, osClick, osKeyPress };
export type { OsClickOptions };

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DESKTOP_MODE_ONLY_ERROR =
  `[screen-capture] ⚠️  SAFETY BLOCK: This plugin is ONLY for desktop mode (--mode=desktop).\n` +
  `It captures the ENTIRE physical screen, including any sensitive content visible outside\n` +
  `the test window. For web browser testing, use ctx.capture() or live-controller instead.\n` +
  `If you are testing a compiled .exe app, add --mode=desktop to your command.`;

const SCREEN_CLICK_WARNING =
  `[screen-capture] ⚠️  OS-LEVEL CLICK: These are PHYSICAL screen coordinates.\n` +
  `They are NOT relative to the browser window. Ensure the target window is focused\n` +
  `and in the foreground. Clicking outside the test app may interact with the OS or\n` +
  `other applications.`;

// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AgentLens plugin: screen-capture
 *
 * ⚠️  DANGEROUS — READ CAREFULLY BEFORE USE ⚠️
 *
 * Captures the OS-level screen (entire primary display or active window) using
 * PowerShell and Win32 APIs. No external npm dependencies.
 *
 * WHEN TO USE:
 *   ✅ Testing compiled Windows .exe apps (WebView2, Electron, Photino, WinForms)
 *   ✅ Capturing native dialogs outside the WebView window (Open File, Permission, Splash)
 *   ✅ Verifying native titlebar, taskbar notifications, system tray icons
 *   ✅ Scenarios where a native popup or OS overlay appears and is NOT inside CDP reach
 *
 * WHEN NOT TO USE:
 *   ❌ Web browser testing — use ctx.capture() instead (CDP-based, exact, safe)
 *   ❌ CI/CD pipelines — no display / virtual framebuffer issues
 *   ❌ Developer machines with sensitive windows open (email, banking, passwords)
 *   ❌ Shared / multi-user environments
 *
 * PRECAUTIONS:
 *   - Close all windows except the test app before running
 *   - Only use in dedicated test machines or VMs
 *   - The captured image will contain EVERYTHING visible on screen
 *   - OS-level clicks affect the real pointer — the app window must be in focus
 *
 * Platform: Windows only (uses PowerShell + System.Windows.Forms + System.Drawing)
 *
 * Usage:
 *   npx agent-lens --scenario=my-app --mode=desktop --plugin=screen-capture
 */
export const screenCapturePlugin: AgentLensPlugin = definePlugin({
  name: 'screen-capture',
  version: '1.0.0',

  setup: (hookContext) => {
    if (hookContext.targetMode !== 'desktop') {
      // Warn loudly but don't crash at setup — the safety guard is in extendContext methods
      console.warn(
        `⚠️ [screen-capture] Plugin loaded in non-desktop mode ("${hookContext.targetMode}"). ` +
        `All screen-capture methods will throw if called. Switch to --mode=desktop.`
      );
    } else {
      console.log(
        `🖥️ [screen-capture] Initialized in desktop mode. ` +
        `OS-level screen capture and input simulation available.\n` +
        `⚠️  REMINDER: Ensure only the test application is visible on screen.`
      );
    }
  },

  extendContext: (_ctx, _page, hookContext) => {
    const artifactsDir = hookContext.artifactsDir;
    const isDesktop = hookContext.targetMode === 'desktop';

    /**
     * Guard: throws a descriptive error if called outside desktop mode.
     */
    function assertDesktopMode(methodName: string): void {
      if (!isDesktop) {
        throw new Error(`${DESKTOP_MODE_ONLY_ERROR}\nCalled from: ctx.${methodName}()`);
      }
    }

    return {
      /**
       * Capture the full primary display at OS level.
       *
       * ⚠️  WARNING: Captures EVERYTHING on screen — not just the test app window.
       * The resulting image will include any other visible windows, taskbar, etc.
       *
       * @param name - Filename without extension (default: 'screen_capture')
       * @returns Absolute path to the saved PNG file
       */
      captureScreen: async (name?: string): Promise<string> => {
        assertDesktopMode('captureScreen');
        const fileName = `${name || 'screen_capture'}.png`;
        const outputPath = path.join(artifactsDir, fileName);
        console.log(`🖥️ [screen-capture] Capturing full primary screen → ${fileName}`);
        return await captureScreen({ outputPath, activeWindowOnly: false });
      },

      /**
       * Capture only the foreground (active) window at OS level.
       *
       * More targeted than captureScreen() but still OS-level — relies on
       * GetForegroundWindow() / GetWindowRect() Win32 APIs.
       *
       * @param name - Filename without extension (default: 'window_capture')
       * @returns Absolute path to the saved PNG file
       */
      captureActiveWindow: async (name?: string): Promise<string> => {
        assertDesktopMode('captureActiveWindow');
        const fileName = `${name || 'window_capture'}.png`;
        const outputPath = path.join(artifactsDir, fileName);
        console.log(`🖥️ [screen-capture] Capturing active window → ${fileName}`);
        return await captureScreen({ outputPath, activeWindowOnly: true });
      },

      /**
       * Click at ABSOLUTE screen pixel coordinates at the OS level.
       *
       * ⚠️  WARNING: This moves the REAL mouse cursor to the given position and clicks.
       * Coordinates are physical screen pixels from the top-left of the primary display.
       * Do NOT confuse with CDP/Playwright coordinates (those are relative to the page).
       *
       * Precondition: the target application window must be focused and in the foreground.
       *
       * @param x - Absolute X coordinate on the primary screen
       * @param y - Absolute Y coordinate on the primary screen
       * @param options - button ('left'|'right'|'middle'), clickCount
       */
      clickScreenAt: async (x: number, y: number, options?: OsClickOptions): Promise<void> => {
        assertDesktopMode('clickScreenAt');
        console.warn(SCREEN_CLICK_WARNING);
        console.log(`🖱️ [screen-capture] OS click at screen coords: (${x}, ${y}) [${options?.button ?? 'left'}×${options?.clickCount ?? 1}]`);
        await osClick(x, y, options);
      },

      /**
       * Send an OS-level key press to the active window via PowerShell SendKeys.
       *
       * Supported keys: 'Enter', 'Escape', 'Tab', 'Space', 'Backspace', 'Delete',
       * 'F1'–'F12', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
       * 'Home', 'End', 'PageUp', 'PageDown', or any single character.
       *
       * @param key - Key name or character to send
       */
      pressOsKey: async (key: string): Promise<void> => {
        assertDesktopMode('pressOsKey');
        console.log(`⌨️ [screen-capture] OS key press: "${key}"`);
        await osKeyPress(key);
      }
    };
  }
});

export default screenCapturePlugin;
