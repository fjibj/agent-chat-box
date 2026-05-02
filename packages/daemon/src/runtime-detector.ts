import { execSync } from 'child_process';

export interface RuntimeInfo {
  name: string;
  binary: string;
  version: string;
  available: boolean;
}

const RUNTIMES = [
  { name: 'claude', binary: 'claude', versionCmd: 'claude --version' },
  { name: 'codex', binary: 'codex', versionCmd: 'codex --version' },
  { name: 'openclaw', binary: 'openclaw', versionCmd: 'openclaw --version' },
  { name: 'hermes', binary: 'hermes', versionCmd: 'hermes --version' },
] as const;

const DETECT_TIMEOUT_MS = 5000;

/** Detect available agent runtimes on this machine */
export async function detectRuntimes(): Promise<RuntimeInfo[]> {
  const results: RuntimeInfo[] = [];

  for (const rt of RUNTIMES) {
    try {
      const output = execSync(rt.versionCmd, {
        timeout: DETECT_TIMEOUT_MS,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).toString().trim();

      const version = parseVersion(output);
      results.push({
        name: rt.name,
        binary: rt.binary,
        version,
        available: true,
      });
      console.log(`[runtime] ${rt.name}: ${version}`);
    } catch {
      results.push({
        name: rt.name,
        binary: rt.binary,
        version: '',
        available: false,
      });
      console.log(`[runtime] ${rt.name}: not found`);
    }
  }

  return results;
}

/** Parse version string from command output */
function parseVersion(output: string): string {
  // Try to extract semver-like pattern
  const match = output.match(/(\d+\.\d+\.\d+)/);
  if (match) return match[1];

  // Try simple number
  const simpleMatch = output.match(/(\d+)/);
  if (simpleMatch) return simpleMatch[1];

  // Return first line truncated
  return output.split('\n')[0]?.substring(0, 50) || 'unknown';
}

/** Get only available runtime names */
export function getAvailableRuntimeNames(runtimes: RuntimeInfo[]): string[] {
  return runtimes.filter(rt => rt.available).map(rt => rt.name);
}
