import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { Task } from '@agent-chat-box/shared';
import { BaseAgentDriver, type AgentProcess, AgentProcessImpl } from './base.js';

/** Resolve claude CLI spawn config to avoid shell quoting issues on Windows.
 *  On Windows .cmd wrapper mangles args with shell:true, so use node cli.js directly. */
function resolveClaudeSpawn(): { cmd: string; prefixArgs: string[]; shell: boolean } {
  const isWin = process.platform === 'win32';
  try {
    const npmGlobalRoot = execSync('npm root -g', { timeout: 5000, stdio: 'pipe' }).toString().trim();
    const cliPath = path.join(npmGlobalRoot, '@anthropic-ai', 'claude-code', 'cli.js');
    if (fs.existsSync(cliPath)) {
      return { cmd: process.execPath, prefixArgs: [cliPath], shell: false };
    }
  } catch { /* fallback */ }
  return { cmd: 'claude', prefixArgs: [], shell: isWin };
}

export class ClaudeCodeDriver extends BaseAgentDriver {
  name = 'claude';
  binary = 'claude';
  capabilities = ['code', 'analysis', 'general', 'typescript', 'javascript', 'python'];

  private spawnCfg = { cmd: 'claude', prefixArgs: [] as string[], shell: process.platform === 'win32' };

  async detect(): Promise<boolean> {
    try {
      execSync('claude --version', { timeout: 5000, stdio: 'pipe' });
      this.spawnCfg = resolveClaudeSpawn();
      console.log(`[claude-driver] Spawn: cmd=${this.spawnCfg.cmd} shell=${this.spawnCfg.shell} prefix=[${this.spawnCfg.prefixArgs}]`);
      return true;
    } catch {
      return false;
    }
  }

  async start(task: Task, context: string): Promise<AgentProcess> {
    const prompt = this.buildPrompt(task, context);
    console.log(`[claude-driver] Starting with prompt: ${prompt.substring(0, 100)}`);

    const id = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const proc = spawn(this.spawnCfg.cmd, [...this.spawnCfg.prefixArgs, '-p', prompt, '--bare'], {
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: this.spawnCfg.shell,
    });

    return new AgentProcessImpl(id, proc);
  }

  /** Chat with Claude Code using -p flag, with optional system prompt */
  override async chat(message: string, systemPrompt?: string): Promise<string> {
    const CHAT_TIMEOUT_MS = 120_000; // 2 minutes
    return new Promise((resolve, reject) => {
      const args = [...this.spawnCfg.prefixArgs, '-p', message];
      if (systemPrompt) {
        args.push('--system-prompt', systemPrompt);
      }
      args.push('--bare');
      console.log(`[claude-driver] chat() cmd=${this.spawnCfg.cmd} shell=${this.spawnCfg.shell}`);
      const proc = spawn(this.spawnCfg.cmd, args, {
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: this.spawnCfg.shell,
      });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Claude chat timed out after ${CHAT_TIMEOUT_MS}ms`));
      }, CHAT_TIMEOUT_MS);

      const chunks: string[] = [];
      proc.stdout.on('data', (data: Buffer) => chunks.push(data.toString()));
      proc.stderr.on('data', (data: Buffer) => chunks.push(data.toString()));

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(chunks.join('').trim());
        } else {
          reject(new Error(`Claude exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private buildPrompt(task: Task, context: string): string {
    return `${task.title}: ${task.description || ''}`;
  }
}
