import { definePlugin, type AgentLensPlugin } from '../../shared/api/plugin';
import { MockIpcRegistry, generateMockIpcScript } from './registry';
import type { MockIpcResponseType } from '../../shared/types/ipc';

export { MockIpcRegistry, generateMockIpcScript };

const STATE_KEY = 'mockIpcRegistry';

export const mockIpcPlugin: AgentLensPlugin = definePlugin({
  name: 'mock-ipc',
  version: '1.0.0',

  setup: (hookContext) => {
    const registry = new MockIpcRegistry();
    hookContext.state.set(STATE_KEY, registry);

    const scenarioMocks = hookContext.scenario?.mockIpc || [];
    const globalMocks = (hookContext.cliOptions?.globalMocks as Array<{ action: string; data: unknown; type?: MockIpcResponseType; delayMs?: number }>) || [];
    const allMocks = [...globalMocks, ...scenarioMocks];

    if (allMocks.length > 0) {
      console.log(`📦 [Plugin:mock-ipc] Pre-loading ${allMocks.length} initial IPC mocks`);
      registry.setBatch(allMocks);
    }
  },

  onContextCreated: async (context, hookContext) => {
    const registry = (hookContext.state.get(STATE_KEY) as MockIpcRegistry) || new MockIpcRegistry();
    const script = generateMockIpcScript(registry);
    await context.addInitScript(script);
    console.log(`🔌 [Plugin:mock-ipc] Injected window.__mockIpc & window.external bridge into browser context`);
  },

  extendContext: (_ctx, page, hookContext) => {
    const registry = (hookContext.state.get(STATE_KEY) as MockIpcRegistry) || new MockIpcRegistry();

    return {
      setMockIpc: async (
        action: string,
        data: unknown,
        options?: { type?: MockIpcResponseType; delayMs?: number }
      ) => {
        const preview = typeof data === 'string' ? data : JSON.stringify(data).slice(0, 80);
        console.log(`📦 [Plugin:mock-ipc] Dynamic set: ${action} -> ${preview}`);
        registry.set(action, data, options);

        await page.evaluate(
          ({ action, mock }) => {
            const w = window as unknown as { __visualRunnerMocks?: Record<string, unknown> };
            if (!w.__visualRunnerMocks) {
              w.__visualRunnerMocks = {};
            }
            w.__visualRunnerMocks[action] = mock;
          },
          {
            action,
            mock: {
              data,
              type: options?.type ?? 'SUCCESS',
              delayMs: options?.delayMs ?? 20
            }
          }
        );
      }
    };
  },

  teardown: (hookContext) => {
    const registry = hookContext.state.get(STATE_KEY) as MockIpcRegistry | undefined;
    if (registry) {
      registry.clear();
      hookContext.state.delete(STATE_KEY);
    }
  }
});

export default mockIpcPlugin;
