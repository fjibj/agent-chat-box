import { execSync, spawn } from 'child_process';
import type { Task } from '@agent-chat-box/shared';
import { BaseAgentDriver, type AgentProcess } from './base.js';

export class ClaudeCodeDriver extends BaseAgentDriver {
  name = 'claude';
  binary = 'claude';
  capabilities = ['code', 'analysis', 'general', 'typescript', 'javascript', 'python'];

  async detect(): Promise<boolean> {
    try {
      execSync('claude --version', { timeout: 5000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async start(task: Task, context: string): Promise<AgentProcess> {
    const prompt = this.buildPrompt(task, context);

    const proc = this.spawnProcess(
      'claude',
      ['--print', '--output-format', 'stream-json', '--prompt', prompt],
      {
        CLAUDE_TASK_ID: task.id,
        CLAUDE_CHANNEL_ID: task.channelId,
      }
    );

    return proc;
  }

  /** Chat with Claude Code using -p flag (positional prompt, shell mode for Windows .cmd) */
  override async chat(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      const isWin = process.platform === 'win32';
      const proc = spawn('claude', ['-p', message], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWin,
      });

      proc.stdout.on('data', (data: Buffer) => chunks.push(data.toString()));
      proc.stderr.on('data', (data: Buffer) => chunks.push(data.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(chunks.join('').trim());
        } else {
          reject(new Error(`Claude exited with code ${code}`));
        }
      });

      proc.on('error', (err) => reject(err));
    });
  }

  private buildPrompt(task: Task, context: string): string {
    const parts = [
      `# Task: ${task.title}`,
      '',
      task.description || 'No description provided.',
      '',
    ];

    if (task.tags && task.tags.length > 0) {
      parts.push(`**Tags:** ${task.tags.join(', ')}`);
    }

    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      parts.push(`**Required capabilities:** ${task.requiredCapabilities.join(', ')}`);
    }

    parts.push('', '## Context', '', context);

    return parts.join('\n');
  }
}
