export interface ConsoleEntry {
  level: 'error' | 'warning' | 'info' | 'log' | 'debug';
  text: string;
  url: string;
  timestamp: string;
  stack?: string;
}
