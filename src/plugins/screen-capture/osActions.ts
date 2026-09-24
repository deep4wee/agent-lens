import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface ScreenshotOptions {
  /** Output file path (.png) */
  outputPath: string;
  /** If true, captures only the foreground active window instead of the entire primary screen */
  activeWindowOnly?: boolean;
}

export interface OsClickOptions {
  /** Mouse button: 'left' | 'right' | 'middle'. Default: 'left' */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks. Default: 1 */
  clickCount?: number;
}

/**
 * Capture the primary display (or active window) at the OS level using PowerShell.
 * Works on Windows without any npm native dependencies.
 *
 * Falls back to a clear error if not on Windows or PowerShell is unavailable.
 */
export async function captureScreen(options: ScreenshotOptions): Promise<string> {
  const { outputPath, activeWindowOnly = false } = options;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Normalize path for PowerShell (forward slashes cause issues)
  const psPath = outputPath.replace(/\//g, '\\');

  let psScript: string;

  if (activeWindowOnly) {
    // Capture only the active (foreground) window bounds
    psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$fg = [System.Windows.Forms.Screen]::PrimaryScreen
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class WinApi {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
    public struct RECT { public int Left, Top, Right, Bottom; }
  }
"@

$hwnd = [WinApi]::GetForegroundWindow()
$rect = New-Object WinApi+RECT
[WinApi]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

$width  = $rect.Right  - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0) { $width = 800 }
if ($height -le 0) { $height = 600 }

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
$bmp.Save("${psPath}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;
  } else {
    // Capture the entire primary screen
    psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("${psPath}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;
  }

  try {
    execSync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      stdio: 'pipe',
      timeout: 10_000
    });
  } catch (err: unknown) {
    // Try alternate invocation with -EncodedCommand for robustness with special chars
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
      stdio: 'pipe',
      timeout: 10_000
    });
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`[screen-capture] PowerShell ran but output file not found: ${outputPath}`);
  }

  return outputPath;
}

/**
 * Perform an OS-level mouse click at absolute screen coordinates using PowerShell.
 *
 * WARNING: These are PHYSICAL SCREEN coordinates — absolute pixel positions on the
 * primary display. They are NOT relative to a browser window or element.
 */
export async function osClick(
  x: number,
  y: number,
  options?: OsClickOptions
): Promise<void> {
  const button = options?.button ?? 'left';
  const clickCount = options?.clickCount ?? 1;

  // Map to .NET mouse event flags
  const downFlag = button === 'right' ? 'RIGHTDOWN' : button === 'middle' ? 'MIDDLEDOWN' : 'LEFTDOWN';
  const upFlag   = button === 'right' ? 'RIGHTUP'   : button === 'middle' ? 'MIDDLEUP'   : 'LEFTUP';

  const clickLoop = Array.from({ length: clickCount }, () => `
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
    $mouse::mouse_event([mouse]::${downFlag}, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 50
    $mouse::mouse_event([mouse]::${upFlag}, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 80
  `).join('\n');

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class mouse {
    public const int LEFTDOWN   = 0x0002;
    public const int LEFTUP     = 0x0004;
    public const int RIGHTDOWN  = 0x0008;
    public const int RIGHTUP    = 0x0010;
    public const int MIDDLEDOWN = 0x0020;
    public const int MIDDLEUP   = 0x0040;
    [DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
    public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
  }
"@
${clickLoop}
`;

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
    stdio: 'pipe',
    timeout: 10_000
  });
}

/**
 * Send an OS-level keypress (e.g. 'Enter', 'Escape', 'Tab', 'F5').
 * Uses PowerShell SendKeys for reliability.
 */
export async function osKeyPress(key: string): Promise<void> {
  // Map common key names to SendKeys syntax
  const keyMap: Record<string, string> = {
    Enter: '{ENTER}',
    Escape: '{ESC}',
    Tab: '{TAB}',
    Space: ' ',
    Backspace: '{BACKSPACE}',
    Delete: '{DELETE}',
    F1: '{F1}', F2: '{F2}', F3: '{F3}', F4: '{F4}', F5: '{F5}',
    F6: '{F6}', F7: '{F7}', F8: '{F8}', F9: '{F9}', F10: '{F10}',
    F11: '{F11}', F12: '{F12}',
    ArrowUp: '{UP}', ArrowDown: '{DOWN}', ArrowLeft: '{LEFT}', ArrowRight: '{RIGHT}',
    Home: '{HOME}', End: '{END}', PageUp: '{PGUP}', PageDown: '{PGDN}'
  };

  const sendKey = keyMap[key] ?? key;

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${sendKey.replace(/"/g, '`"')}")
`;

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
    stdio: 'pipe',
    timeout: 5_000
  });
}
