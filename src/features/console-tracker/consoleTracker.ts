import type { Page, ConsoleMessage } from 'playwright';
import type { ConsoleEntry } from '../../shared/types/console';

export type { ConsoleEntry };


export class ConsoleTracker {
  private entries: ConsoleEntry[] = [];
  private attached = false;

  public attach(page: Page): void {
    if (this.attached) return;
    this.attached = true;

    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type(); // 'log' | 'error' | 'warning' | 'info' | 'debug' | 'trace' | ...
      const level = this.mapConsoleType(type);

      const entry: ConsoleEntry = {
        level,
        text: msg.text(),
        url: page.url(),
        timestamp: new Date().toISOString()
      };

      this.entries.push(entry);

      if (level === 'error') {
        console.log(`🔴 [Console ERROR] ${msg.text()}`);
      } else if (level === 'warning') {
        if (!this.isIgnoredWarning(msg.text())) {
          console.log(`🟡 [Console WARN] ${msg.text()}`);
        }
      }
    });

    page.on('pageerror', (error: Error) => {
      const entry: ConsoleEntry = {
        level: 'error',
        text: error.message,
        url: page.url(),
        timestamp: new Date().toISOString(),
        stack: error.stack
      };

      this.entries.push(entry);
      console.log(`💥 [Page ERROR] ${error.message}`);
    });
  }

  public getErrors(): ConsoleEntry[] {
    return this.entries.filter(e => e.level === 'error');
  }

  public getWarnings(): ConsoleEntry[] {
    return this.entries
      .filter(e => e.level === 'warning')
      .filter(e => !this.isIgnoredWarning(e.text));
  }

  public getAll(): ConsoleEntry[] {
    return [...this.entries];
  }

  public get errorCount(): number {
    return this.getErrors().length;
  }

  public get warningCount(): number {
    return this.getWarnings().length;
  }

  public get hasErrors(): boolean {
    return this.errorCount > 0;
  }

  public clear(): void {
    this.entries = [];
  }


  private mapConsoleType(type: string): ConsoleEntry['level'] {
    switch (type) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      case 'debug': return 'debug';
      default: return 'log';
    }
  }


  private isIgnoredWarning(text: string): boolean {
    const ignoredPatterns = [
      'findDOMNode is deprecated',
      // Chromium DevTools
      'DevTools',
      // Playwright injection
      '__playwright',
      '[vite]',
      // React 18 hydration warnings
      'Extra attributes from the server',
      'Download the React DevTools',
    ];
    return ignoredPatterns.some(pattern => text.includes(pattern));
  }
}
