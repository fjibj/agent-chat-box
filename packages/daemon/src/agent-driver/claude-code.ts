import { execSync, spawn } from 'child_process';
import type { Task } from '@agent-chat-box/shared';
import { BaseAgentDriver, type AgentProcess, AgentProcessImpl } from './base.js';

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
    console.log(`[claude-driver] Starting with prompt: ${prompt.substring(0, 100)}`);

    // Use exact same spawn pattern as chat() which works
    const id = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const isWin = process.platform === 'win32';
    const proc = spawn('claude', ['-p', prompt], {
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });

    return new AgentProcessImpl(id, proc);
  }

  /** Chat with Claude Code using -p flag */
  override async chat(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const isWin = process.platform === 'win32';
      const proc = spawn('claude', ['-p', message], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWin,
      });

      const chunks: string[] = [];
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
    return `${task.title}: ${task.description || ''}`;
  }
}
