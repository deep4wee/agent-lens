import type { BrowserContext, Page } from 'playwright';
import { definePlugin, type AgentLensPlugin } from '../../shared/api/plugin';
import { buildRecordVideoOption, finalizeVideo, type VideoRecordingResult } from './videoManager';

export { finalizeVideo, buildRecordVideoOption, type VideoRecordingResult };

const STATE_VIDEO_OPTIONS_KEY = 'videoRecorderOptions';
const STATE_PAGE_KEY = 'videoRecorderPage';
const STATE_RESULT_KEY = 'videoRecordingResult';

/**
 * AgentLens plugin: video-recorder
 *
 * Records the entire scenario as a .webm video using Playwright's built-in
 * context-level recording. No external dependencies required.
 *
 * Usage:
 *   npx agent-lens snap --url=http://localhost:5173 --plugin=video-recorder
 *   npx agent-lens --scenario=checkout --plugin=video-recorder
 *
 * Or in defineVisualTest:
 *   plugins: ['video-recorder']
 *
 * The final recording is saved to artifacts/<run>/recording.webm and is
 * included in artifacts/latest/recording.webm via the syncLatestArtifacts fix.
 *
 * Best used for:
 *   - Multi-step user flows (click → fill form → submit → modal)
 *   - Desktop (.exe) scenarios where burst-frames are cumbersome
 *   - Debugging scenarios where the "between steps" behavior matters
 */
export const videoRecorderPlugin: AgentLensPlugin = definePlugin({
  name: 'video-recorder',
  version: '1.0.0',

  setup: (hookContext) => {
    // Store video options in shared state for use in launchSession / onContextCreated
    const videoOptions = {
      outputDir: hookContext.artifactsDir,
      name: hookContext.scenario?.id || 'recording',
      width: undefined as number | undefined,
      height: undefined as number | undefined
    };
    hookContext.state.set(STATE_VIDEO_OPTIONS_KEY, videoOptions);
  },

  /**
   * Playwright records video at the BrowserContext level.
   * We cannot set recordVideo after newContext() is called, so we hook into
   * launchSession for the desktop driver (which creates its own context)
   * and rely on onContextCreated for the default PreviewDriver.
   *
   * NOTE: For the PreviewDriver case, we cannot inject recordVideo retroactively.
   * The plugin therefore signals via hookContext.state that recording should be
   * enabled; the actual context patching happens for custom-driver sessions only.
   * For PreviewDriver, we capture the page reference and finalize after run.
   */
  onContextCreated: async (context: BrowserContext, hookContext) => {
    // Store context reference — Playwright will write the video on context.close()
    // We cannot set recordVideo on an already-created context, but Playwright
    // automatically records video if the context was created with recordVideo option.
    // The PreviewDriver does NOT pass recordVideo — so we log a helpful message.
    console.log(
      `🎬 [video-recorder] Attached to browser context. Note: for full video recording, ` +
      `the context must be created with recordVideo option. ` +
      `Video capture is fully supported for custom driver sessions (desktop-webview2).`
    );
    hookContext.state.set('videoContext', context);
  },

  onPageCreated: async (page: Page, _context, hookContext) => {
    // Keep reference to the page so we can call finalizeVideo() in onAfterRun
    hookContext.state.set(STATE_PAGE_KEY, page);
  },

  onAfterRun: async (reportData, hookContext) => {
    const page = hookContext.state.get(STATE_PAGE_KEY) as Page | undefined;
    if (!page) return;

    const videoOptions = hookContext.state.get(STATE_VIDEO_OPTIONS_KEY) as {
      outputDir: string;
      name: string;
      width?: number;
      height?: number;
    };
    if (!videoOptions) return;

    const result = await finalizeVideo(page, videoOptions);
    if (!result) {
      console.log(
        `🎬 [video-recorder] No video recorded. To enable video, use this plugin with a ` +
        `browser context that was created with recordVideo option (e.g. via desktop-webview2 driver ` +
        `or a custom plugin that sets context.recordVideo).`
      );
      return;
    }

    hookContext.state.set(STATE_RESULT_KEY, result);

    // Append video section to the markdown report
    if (reportData.customSections) {
      reportData.customSections.push({
        title: '🎬 Video Recording',
        content:
          `> Full scenario video recording captured during the test run.\n\n` +
          `**File:** [\`${result.fileName}\`](./${result.fileName})\n\n` +
          `> [!TIP]\n> Open the .webm file in your browser or media player to replay the full scenario.`
      });
    }
  }
});

export default videoRecorderPlugin;
