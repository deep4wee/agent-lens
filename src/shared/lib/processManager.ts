import { spawn, type ChildProcess } from 'child_process';
import treeKill from 'tree-kill';

export interface ProcessManagerOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
}

export class ProcessManager {
  private child: ChildProcess | null = null;
  private stderrOutput: string = '';
  private stdoutOutput: string = '';
  private hasExited: boolean = false;
  private exitCode: number | null = null;

  /**
   * Spawns a background process (e.g. dev server, backend, or app)
   */
  public async start(command: string, options?: ProcessManagerOptions): Promise<void> {
    this.stderrOutput = '';
    this.stdoutOutput = '';
    this.hasExited = false;
    this.exitCode = null;

    const cwd = options?.cwd || process.cwd();
    const env = { ...process.env, ...options?.env };

    console.log(`🚀 [ProcessManager] Starting command: "${command}" in ${cwd}`);

    this.child = spawn(command, {
      cwd,
      env,
      shell: options?.shell ?? true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.child.stdout?.on('data', (chunk) => {
      const str = chunk.toString();
      this.stdoutOutput += str;
    });

    this.child.stderr?.on('data', (chunk) => {
      const str = chunk.toString();
      this.stderrOutput += str;
    });

    this.child.on('exit', (code) => {
      this.hasExited = true;
      this.exitCode = code;
    });

    this.child.on('error', (err) => {
      console.error(`❌ [ProcessManager] Failed to start command: "${command}":`, err.message);
    });
  }

  /**
   * Polls a URL until it starts responding or until timeout is reached.
   */
  public async waitForUrl(url: string, timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    console.log(`⏳ [ProcessManager] Waiting for URL to become available: ${url} (timeout: ${timeoutMs / 1000}s)...`);

    while (Date.now() - startTime < timeoutMs) {
      if (this.hasExited && this.exitCode !== 0) {
        throw new Error(
          `[ProcessManager] Process exited prematurely with code ${this.exitCode}.\nStderr:\n${this.stderrOutput.trim() || '(no stderr)'}\nStdout:\n${this.stdoutOutput.slice(-500).trim()}`
        );
      }

      try {
        const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(2000) });
        // Any HTTP response (even 404 or 500) means the server is listening!
        if (response.status) {
          console.log(`✅ [ProcessManager] Server responded with status ${response.status} at ${url}`);
          return;
        }
      } catch {
        // Connection refused or timed out, retry
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    throw new Error(
      `[ProcessManager] Timeout (${timeoutMs / 1000}s) waiting for server at ${url}.\nLast stdout:\n${this.stdoutOutput.slice(-500).trim()}\nLast stderr:\n${this.stderrOutput.trim()}`
    );
  }

  /**
   * Gracefully and forcefully kills the process and all its children.
   */
  public async stop(): Promise<void> {
    if (!this.child || !this.child.pid || this.hasExited) {
      this.child = null;
      return;
    }

    const pid = this.child.pid;
    console.log(`🛑 [ProcessManager] Terminating process tree (PID: ${pid})...`);

    await new Promise<void>((resolve) => {
      treeKill(pid, 'SIGKILL', (err) => {
        if (err) {
          // Fallback to taskkill on Windows if tree-kill hit permission issues
          if (process.platform === 'win32') {
            try {
              spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
            } catch {
              // ignore
            }
          }
        }
        resolve();
      });
    });

    this.child = null;
  }
}
