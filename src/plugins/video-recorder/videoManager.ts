import fs from 'fs';
import path from 'path';
import type { Page } from 'playwright';

export interface VideoRecorderOptions {
  /** Output directory where the final .webm video will be saved (defaults to artifactsDir) */
  outputDir: string;
  /** Base name for the output file, without extension (defaults to 'recording') */
  name?: string;
  /** Video size — defaults to current viewport size */
  width?: number;
  height?: number;
}

export interface VideoRecordingResult {
  /** Absolute path to the saved .webm file */
  videoPath: string;
  /** Filename only, for report links */
  fileName: string;
}

/**
 * Returns the Playwright `recordVideo` option to pass when creating a browser context.
 * Playwright saves each page's video automatically on context close.
 */
export function buildRecordVideoOption(
  options: VideoRecorderOptions
): { dir: string; size?: { width: number; height: number } } {
  const recordOption: { dir: string; size?: { width: number; height: number } } = {
    dir: options.outputDir
  };

  if (options.width && options.height) {
    recordOption.size = { width: options.width, height: options.height };
  }

  return recordOption;
}

/**
 * After the scenario finishes, retrieves the recorded video path from the page
 * and copies/renames it to a predictable filename inside outputDir.
 *
 * Must be called BEFORE the browser context is closed — Playwright finalizes
 * video writing on context.close(), so we call page.video()?.path() right before.
 */
export async function finalizeVideo(
  page: Page,
  options: VideoRecorderOptions
): Promise<VideoRecordingResult | null> {
  try {
    // page.video() is only available when recordVideo was set on the context
    const video = page.video();
    if (!video) {
      return null;
    }

    // This resolves once the video file is actually written to disk
    const rawPath = await video.path();
    if (!rawPath || !fs.existsSync(rawPath)) {
      return null;
    }

    const baseName = options.name || 'recording';
    const fileName = `${baseName}.webm`;
    const destPath = path.join(options.outputDir, fileName);

    // If it landed in a different dir, move it to the artifacts dir
    if (path.resolve(rawPath) !== path.resolve(destPath)) {
      fs.copyFileSync(rawPath, destPath);
      // Clean up the temp file Playwright created
      try {
        fs.unlinkSync(rawPath);
      } catch {
        // Non-critical — temp cleanup
      }
    }

    console.log(`🎬 [video-recorder] Video saved: ${destPath}`);
    return { videoPath: destPath, fileName };
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`❌ [video-recorder] Failed to finalize video: ${e.message}`);
    return null;
  }
}
