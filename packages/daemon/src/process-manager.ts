import type { Task } from '@agent-chat-box/shared';
import { MSG } from '@agent-chat-box/shared';
import type { BaseAgentDriver, AgentProcess } from './agent-driver/base.js';
import type { DaemonConnection } from './connection.js';

export interface ManagedProcess {
  id: string;
  agentId: string;
  taskId: string;
  process: AgentProcess;
  startedAt: number;
}

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private connection: DaemonConnection;

  constructor(connection: DaemonConnection) {
    this.connection = connection;
  }

  /** Start a task with a driver */
  async start(agentId: string, driver: BaseAgentDriver, task: Task, context: string): Promise<string> {
    const process = await driver.start(task, context);
    const managed: ManagedProcess = {
      id: process.id,
      agentId,
      taskId: task.id,
      process,
      startedAt: Date.now(),
    };

    this.processes.set(process.id, managed);

    // Mark task as running
    this.connection.send(MSG.TASK_UPDATE, {
      task_id: task.id,
      status: 'running',
    });

    // Stream output to server
    process.onOutput((chunk) => {
      // Could extend server to handle progress chunks; for now just log
      console.log(`[process] [${task.id}] ${chunk.substring(0, 200)}`);
    });

    // Handle completion
    process.onComplete((result) => {
      this.processes.delete(process.id);
      this.connection.send(MSG.TASK_UPDATE, {
        task_id: task.id,
        status: 'completed',
        output: result.output.slice(0, 10000), // cap output size
      });
      console.log(`[process] Task ${task.id} completed by ${driver.name} (exit=${result.exitCode})`);
    });

    // Handle errors
    process.onError((error) => {
      this.processes.delete(process.id);
      this.connection.send(MSG.TASK_UPDATE, {
        task_id: task.id,
        status: 'failed',
        output: error.message,
      });
      console.error(`[process] Task ${task.id} failed: ${error.message}`);
    });

    console.log(`[process] Started task ${task.id} with ${driver.name} (process: ${process.id})`);
    return process.id;
  }

  /** Kill a specific process */
  kill(processId: string): boolean {
    const managed = this.processes.get(processId);
    if (!managed) return false;

    managed.process.kill();
    this.processes.delete(processId);
    console.log(`[process] Killed process ${processId}`);
    return true;
  }

  /** Kill all processes for an agent */
  killByAgent(agentId: string): number {
    let count = 0;
    for (const [id, managed] of this.processes) {
      if (managed.agentId === agentId) {
        managed.process.kill();
        this.processes.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Kill all processes */
  killAll(): number {
    const count = this.processes.size;
    for (const [, managed] of this.processes) {
      managed.process.kill();
    }
    this.processes.clear();
    return count;
  }

  /** Get all running processes */
  getRunning(): ManagedProcess[] {
    return Array.from(this.processes.values());
  }

  /** Get process by ID */
  get(processId: string): ManagedProcess | undefined {
    return this.processes.get(processId);
  }

  /** Get processes for a specific task */
  getByTask(taskId: string): ManagedProcess | undefined {
    for (const managed of this.processes.values()) {
      if (managed.taskId === taskId) return managed;
    }
    return undefined;
  }

  /** Check if a task is running */
  isTaskRunning(taskId: string): boolean {
    return this.getByTask(taskId) !== undefined;
  }
}
