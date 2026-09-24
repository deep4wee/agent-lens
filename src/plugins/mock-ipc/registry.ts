import type { MockIpcResponseType, MockIpcEntry } from '../../shared/types/ipc';

export class MockIpcRegistry {
  private mocks = new Map<string, MockIpcEntry>();

  public set(action: string, data: any, options?: { type?: MockIpcResponseType; delayMs?: number }): void {
    this.mocks.set(action, {
      action,
      data,
      type: options?.type ?? 'SUCCESS',
      delayMs: options?.delayMs ?? 20
    });
  }

  public setBatch(entries: Array<{ action: string; data: any; type?: MockIpcResponseType; delayMs?: number }>): void {
    for (const entry of entries) {
      this.set(entry.action, entry.data, { type: entry.type, delayMs: entry.delayMs });
    }
  }

  public remove(action: string): void {
    this.mocks.delete(action);
  }

  public clear(): void {
    this.mocks.clear();
  }

  public get(action: string): MockIpcEntry | null {
    return this.mocks.get(action) ?? null;
  }

  public toSerializable(): Record<string, { data: any; type: string; delayMs: number }> {
    const result: Record<string, { data: any; type: string; delayMs: number }> = {};
    for (const [action, entry] of this.mocks.entries()) {
      result[action] = {
        data: entry.data,
        type: entry.type ?? 'SUCCESS',
        delayMs: entry.delayMs ?? 20
      };
    }
    return result;
  }

  public get size(): number {
    return this.mocks.size;
  }
}

export function generateMockIpcScript(registry: MockIpcRegistry): string {
  const mocksJson = JSON.stringify(registry.toSerializable());

  return `
    (() => {
      const __mockTable = ${mocksJson};

      window.__visualRunnerMocks = __mockTable;

      // Generic IPC mock bridge for modern web applications
      window.__mockIpc = {
        invoke: (action, payload) => {
          return new Promise((resolve, reject) => {
            const mock = window.__visualRunnerMocks[action];

            if (mock) {
              setTimeout(() => {
                if (mock.type === 'ERROR') {
                  reject(new Error(mock.data));
                } else {
                  resolve(mock.data);
                }
              }, mock.delayMs || 20);
            } else {
              console.warn('[Mock IPC] No mock for action:', action, '— returning empty SUCCESS');
              setTimeout(() => resolve(null), 20);
            }
          });
        }
      };

      // Safe fallback bridge for hybrid webviews (Photino / CEF / WebView2)
      try {
        if (!window.external) {
          window.external = {};
        }
        window.external.sendMessage = (msg) => {
          try {
            const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;
            const action = parsed.Action || parsed.action;
            const id = parsed.Id || parsed.id;
            const mock = window.__visualRunnerMocks[action];

            if (mock) {
              const response = { Id: id, Type: mock.type || 'SUCCESS', Data: mock.data };
              setTimeout(() => {
                const cb = window.__mockCallback;
                if (typeof cb === 'function') cb(JSON.stringify(response));
              }, mock.delayMs || 20);
            } else {
              setTimeout(() => {
                const cb = window.__mockCallback;
                if (typeof cb === 'function') cb(JSON.stringify({ Id: id, Type: 'SUCCESS', Data: null }));
              }, 20);
            }
          } catch (e) {
            console.error('[Mock IPC] Failed to process message:', e);
          }
        };

        window.external.receiveMessage = (callback) => {
          window.__mockCallback = callback;
        };
      } catch {
        // Ignored if window.external is read-only in strict Chromium sandboxes
      }

      console.log('[Visual Runner] Mock IPC bridge initialized with', Object.keys(window.__visualRunnerMocks).length, 'mocked actions');
    })();
  `;
}
