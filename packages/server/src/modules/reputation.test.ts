import { describe, it, expect } from 'vitest';
import { checkThreshold, getReputationScore, recordReputation } from './reputation.js';
import { buildApp } from '../test-helpers.js';

describe('Reputation Module', () => {
  it('checkThreshold returns false for new team with no records', async () => {
    await buildApp();
    const result = checkThreshold('team-new', 'group-1', 1);
    expect(result).toBe(false);
  });

  it('getReputationScore returns 0 for team with no records', async () => {
    await buildApp();
    const score = getReputationScore('team-new', 'group-1');
    expect(score).toBe(0);
  });

  it('getReputationScore returns correct sum after records', async () => {
    await buildApp();
    recordReputation('team-scored', 'group-1', 'task_completed', 't1');
    recordReputation('team-scored', 'group-1', 'task_completed', 't2');
    recordReputation('team-scored', 'group-1', 'task_failed', 't3');
    const score = getReputationScore('team-scored', 'group-1');
    expect(score).toBe(1);
  });
});
