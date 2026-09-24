export type MockIpcResponseType = 'SUCCESS' | 'ERROR';

export interface MockIpcEntry {
  action: string;
  data: any;
  type?: MockIpcResponseType;
  delayMs?: number;
}
