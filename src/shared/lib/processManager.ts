import { spawn, type ChildProcess } from 'child_process';
import treeKill from 'tree-kill';

export interface ProcessStartOptions {
        
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export class ProcessManager {
  private childProcess: ChildProcess | null = null;
  private isStopped = false;

  public async start(command: string, options?: ProcessStartOptions): Promise<void> {
    const cwd = options?.cwd || process.cwd();
    console.log(`🚀 [ProcessManager] Starting command: "${command}" in ${cwd}`);

    this.childProcess = spawn(command, {
      cwd,
      env: { ...process.env, ...options?.env },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.childProcess.stdout?.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) {
        // Subprocess stdout output handled silently unless needed
      }
    });

    this.childProcess.stderr?.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line && !line.includes('ExperimentalWarning')) {
        // Forward warning if necessary
      }
    });

    this.childProcess.on('exit', (code, signal) => {
      if (!this.isStopped && code !== 0 && code !== null) {
        console.warn(`⚠️ [ProcessManager] Subprocess exited prematurely with code ${code}, signal ${signal}`);
      }
    });
  }

  public async waitForUrl(url: string, timeoutMs = 30000): Promise<boolean> {
    console.log(`⏳ [ProcessManager] Waiting for ${url} to respond...`);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.childProcess && this.childProcess.exitCode !== null) {
        throw new Error(
          `[ProcessManager] Server process exited with code ${this.childProcess.exitCode} while waiting for ${url}`
        );
      }

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (response.status) {
          console.log(`✅ [ProcessManager] Target ${url} is ready (status: ${response.status})!`);
          return true;
        }
      } catch {
        // Retry on connection refused or timeout
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    throw new Error(`[ProcessManager] Timeout after ${timeoutMs}ms waiting for ${url} to respond.`);
  }

  public async stop(): Promise<void> {
    if (this.isStopped || !this.childProcess || !this.childProcess.pid) {
      return;
    }

    this.isStopped = true;
    const pid = this.childProcess.pid;
    console.log(`🛑 [ProcessManager] Terminating process tree for PID ${pid}...`);

    await new Promise<void>((resolve) => {
      treeKill(pid, 'SIGTERM', (err) => {
        if (err) {
          try {
            treeKill(pid, 'SIGKILL');
          } catch {
            // ignore
          }
        }
        resolve();
      });
    });

    this.childProcess = null;
  }
}