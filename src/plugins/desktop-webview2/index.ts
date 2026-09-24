import { definePlugin, type AgentLensPlugin } from '../../shared/api/plugin';
import { DesktopDriver } from './driver';

export interface DesktopPluginOptions {
  executablePath?: string;
  port?: number;
  autoLaunch?: boolean;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

let activeDriver: DesktopDriver | null = null;

export const desktopWebview2Plugin: AgentLensPlugin = definePlugin({
  name: 'desktop-webview2',
  version: '1.0.0',

  launchSession: async (options, hookContext) => {
    // Only intercept if targetMode is desktop or an executable is explicitly provided
    const cliOpts = hookContext.cliOptions || {};
    const isDesktopMode = hookContext.targetMode === 'desktop';
    const hasExe = Boolean(cliOpts.executablePath || cliOpts.exe);

    if (!isDesktopMode && !hasExe) {
      return undefined;
    }

    console.log(`🔌 [Plugin:desktop-webview2] Initializing native desktop bridge...`);

    const driver = new DesktopDriver({
      executablePath: typeof cliOpts.executablePath === 'string'
        ? cliOpts.executablePath
        : typeof cliOpts.exe === 'string'
        ? cliOpts.exe
        : undefined,
      port: typeof cliOpts.port === 'number' ? cliOpts.port : 9222,
      autoLaunch: typeof cliOpts.autoLaunchDesktop === 'boolean' ? cliOpts.autoLaunchDesktop : true,
      args: Array.isArray(cliOpts.desktopArgs) ? (cliOpts.desktopArgs as string[]) : undefined,
      env: (cliOpts.desktopEnv as Record<string, string>) || undefined,
      cwd: typeof cliOpts.startCwd === 'string' ? cliOpts.startCwd : undefined
    });

    activeDriver = driver;
    const session = await driver.start(options.currentViewport);

    return {
      page: session.page,
      context: session.context,
      browser: session.browser,
      stop: async () => {
        await driver.stop();
        activeDriver = null;
      }
    };
  },

  teardown: async () => {
    if (activeDriver) {
      await activeDriver.stop();
      activeDriver = null;
    }
  }
});

export default desktopWebview2Plugin;
