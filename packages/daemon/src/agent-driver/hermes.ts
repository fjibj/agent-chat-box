import { execSync } from 'child_process';
import type { Task } from '@agent-chat-box/shared';
import { BaseAgentDriver, type AgentProcess } from './base.js';

export class HermesDriver extends BaseAgentDriver {
  name = 'hermes';
  binary = 'hermes';
  capabilities = ['code', 'analysis', 'general'];

  async detect(): Promise<boolean> {
    try {
      execSync('hermes --version', { timeout: 5000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async start(task: Task, context: string): Promise<AgentProcess> {
    const prompt = this.buildPrompt(task, context);

    // Hermes CLI invocation (placeholder - adjust based on actual CLI)
    const proc = this.spawnProcess('hermes', ['--prompt', prompt], {
      HERMES_TASK_ID: task.id,
      HERMES_CHANNEL_ID: task.channelId,
    });

    return proc;
  }

  private buildPrompt(task: Task, context: string): string {
    const parts = [`Task: ${task.title}`, '', task.description || 'No description provided.', ''];

    if (task.tags && task.tags.length > 0) {
      parts.push(`Tags: ${task.tags.join(', ')}`);
    }

    parts.push('', 'Context:', '', context);

    return parts.join('\n');
  }
}
