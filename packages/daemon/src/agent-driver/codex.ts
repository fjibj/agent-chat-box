import { execSync } from 'child_process';
import type { Task } from '@agent-chat-box/shared';
import { BaseAgentDriver, type AgentProcess } from './base.js';

export class CodexDriver extends BaseAgentDriver {
  name = 'codex';
  binary = 'codex';
  capabilities = ['code', 'general', 'javascript', 'python'];

  async detect(): Promise<boolean> {
    try {
      execSync('codex --version', { timeout: 5000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async start(task: Task, context: string): Promise<AgentProcess> {
    const prompt = this.buildPrompt(task, context);

    const proc = this.spawnProcess(
      'codex',
      ['--quiet', prompt],
      {
        CODEX_TASK_ID: task.id,
        CODEX_CHANNEL_ID: task.channelId,
      }
    );

    return proc;
  }

  private buildPrompt(task: Task, context: string): string {
    const parts = [
      `Task: ${task.title}`,
      '',
      task.description || 'No description provided.',
      '',
    ];

    if (task.tags && task.tags.length > 0) {
      parts.push(`Tags: ${task.tags.join(', ')}`);
    }

    parts.push('', 'Context:', '', context);

    return parts.join('\n');
  }
}
