import { spawn, ChildProcess } from 'child_process';
import type { Task } from '@agent-chat-box/shared';

export interface TaskResult {
  output: string;
  exitCode: number;
}

export interface AgentProcess {
  id: string;
  status: 'running' | 'completed' | 'failed';
  onOutput(callback: (chunk: string) => void): void;
  onComplete(callback: (result: TaskResult) => void): void;
  onError(callback: (error: Error) => void): void;
  kill(): void;
}

/** Base implementation of AgentProcess using child_process */
export class AgentProcessImpl implements AgentProcess {
  id: string;
  status: 'running' | 'completed' | 'failed' = 'running';

  private proc: ChildProcess;
  private outputCallbacks: Array<(chunk: string) => void> = [];
  private completeCallbacks: Array<(result: TaskResult) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private outputChunks: string[] = [];

  constructor(id: string, proc: ChildProcess) {
    this.id = id;
    this.proc = proc;

    // Collect stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      this.outputChunks.push(chunk);
      this.outputCallbacks.forEach((cb) => cb(chunk));
    });

    // Collect stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      this.outputChunks.push(chunk);
      this.outputCallbacks.forEach((cb) => cb(chunk));
    });

    // Handle completion
    proc.on('close', (code) => {
      this.status = code === 0 ? 'completed' : 'failed';
      const result: TaskResult = {
        output: this.outputChunks.join(''),
        exitCode: code ?? 1,
      };
      this.completeCallbacks.forEach((cb) => cb(result));
    });

    // Handle errors
    proc.on('error', (err) => {
      this.status = 'failed';
      this.errorCallbacks.forEach((cb) => cb(err));
    });
  }

  onOutput(callback: (chunk: string) => void): void {
    this.outputCallbacks.push(callback);
  }

  onComplete(callback: (result: TaskResult) => void): void {
    this.completeCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  kill(): void {
    if (this.proc.pid) {
      this.proc.kill('SIGTERM');
    }
  }
}

/** Base class for all agent drivers */
export abstract class BaseAgentDriver {
  abstract name: string;
  abstract binary: string;
  abstract capabilities: string[];

  /** Detect if this agent CLI is available */
  abstract detect(): Promise<boolean>;

  /** Start a task and return an AgentProcess */
  abstract start(task: Task, context: string): Promise<AgentProcess>;

  /** Send a chat message and get a text response */
  async chat(message: string, _systemPrompt?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      const proc = this.spawnProcess(this.binary, ['--print', '--prompt', message]);
      proc.onOutput((chunk) => chunks.push(chunk));
      proc.onComplete((result) => {
        if (result.exitCode === 0) {
          resolve(chunks.join('').trim());
        } else {
          reject(
            new Error(`Agent exited with code ${result.exitCode}: ${result.output.slice(0, 200)}`),
          );
        }
      });
      proc.onError((err) => reject(err));
    });
  }

  /** Spawn a child process with common error handling */
  protected spawnProcess(cmd: string, args: string[], env?: Record<string, string>): AgentProcess {
    const id = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const isWin = process.platform === 'win32';
    const proc = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });
    return new AgentProcessImpl(id, proc);
  }
}

/** Driver registry */
export const drivers: BaseAgentDriver[] = [];

/** Register a driver */
export function registerDriver(driver: BaseAgentDriver): void {
  drivers.push(driver);
  console.log(`[driver] Registered: ${driver.name}`);
}

/** Get all available drivers (detected) */
export async function getAvailableDrivers(): Promise<BaseAgentDriver[]> {
  const available: BaseAgentDriver[] = [];
  for (const driver of drivers) {
    try {
      if (await driver.detect()) {
        available.push(driver);
      }
    } catch {
      // Detection failed, skip
    }
  }
  return available;
}

/** Get driver by name */
export function getDriver(name: string): BaseAgentDriver | undefined {
  return drivers.find((d) => d.name === name);
}
