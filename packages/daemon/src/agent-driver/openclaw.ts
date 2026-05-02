import { execSync } from 'child_process';
import type { Task } from '@agent-chat-box/shared';
import { BaseAgentDriver, type AgentProcess } from './base.js';

export class OpenClawDriver extends BaseAgentDriver {
  name = 'openclaw';
  binary = 'openclaw';
  capabilities = ['code', 'analysis', 'general'];

  async detect(): Promise<boolean> {
    try {
      execSync('openclaw --version', { timeout: 5000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async start(task: Task, context: string): Promise<AgentProcess> {
    const prompt = this.buildPrompt(task, context);

    // OpenClaw CLI invocation (placeholder - adjust based on actual CLI)
    const proc = this.spawnProcess(
      'openclaw',
      ['--prompt', prompt],
      {
        OPENCLAW_TASK_ID: task.id,
        OPENCLAW_CHANNEL_ID: task.channelId,
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
