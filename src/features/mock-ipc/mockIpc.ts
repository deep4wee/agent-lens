/**
 * Backward compatibility re-export.
 * Mock IPC functionality now lives in the modular plugin at src/plugins/mock-ipc.
 */
export {
  MockIpcRegistry,
  generateMockIpcScript,
  mockIpcPlugin,
  default
} from '../../plugins/mock-ipc';

export type { MockIpcResponseType, MockIpcEntry } from '../../shared/types/ipc';
