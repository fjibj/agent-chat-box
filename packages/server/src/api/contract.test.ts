import { describe, it, expect } from 'vitest';
import { buildApp, createTeam, createGroup } from '../test-helpers.js';
import yaml from 'js-yaml';

// Automate: Contract YAML ↔ JSON Roundtrip Tests
// Covers P1: G007 Group Contract Config

describe('Contract YAML ↔ JSON Roundtrip', () => {
  it('default contract roundtrips correctly', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Contract', 'user-1');
    const group = await createGroup(app, 'Roundtrip Group', team.id);

    // GET contract as JSON
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/contract`,
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.contract).toBeDefined();
    expect(getBody.contract.authorization).toBe('manual');
    expect(getBody.contract.trust_threshold).toBe(0.5);
    expect(getBody.contract.shared_capabilities).toContain('code');
    expect(getBody.contract.visibility.task_output).toBe(true);
    expect(getBody.contract.visibility.internal_log).toBe(false);

    // PATCH with modified contract
    const newContract = {
      ...getBody.contract,
      authorization: 'auto',
      trust_threshold: 0.8,
      shared_capabilities: ['code', 'review', 'test'],
      resource_quota: { max_tasks_per_hour: 20, max_retry_per_task: 5 },
      visibility: { task_input: true, task_output: false, internal_log: true },
    };

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${group.id}/contract`,
      payload: { contract: newContract },
    });
    expect(patchRes.statusCode).toBe(200);

    // GET again and verify
    const get2Res = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/contract`,
    });
    const get2Body = JSON.parse(get2Res.payload);
    expect(get2Body.contract.authorization).toBe('auto');
    expect(get2Body.contract.trust_threshold).toBe(0.8);
    expect(get2Body.contract.shared_capabilities).toContain('review');
    expect(get2Body.contract.visibility.task_output).toBe(false);
    expect(get2Body.contract.visibility.internal_log).toBe(true);
    expect(get2Body.contract.resource_quota.max_tasks_per_hour).toBe(20);
  });

  it('YAML dump produces valid YAML', async () => {
    const contract = {
      shared_capabilities: ['code', 'review'],
      resource_quota: { max_tasks_per_hour: 10, max_retry_per_task: 3 },
      authorization: 'manual',
      trust_threshold: 0.5,
      visibility: { task_input: true, task_output: true, internal_log: false },
    };

    const yamlStr = yaml.dump(contract);
    expect(yamlStr).toContain('shared_capabilities:');
    expect(yamlStr).toContain('- code');
    expect(yamlStr).toContain('authorization: manual');
    expect(yamlStr).toContain('trust_threshold: 0.5');

    // Parse back
    const parsed = yaml.load(yamlStr) as Record<string, unknown>;
    expect(parsed.authorization).toBe('manual');
    expect((parsed.shared_capabilities as string[])[0]).toBe('code');
    expect((parsed.visibility as Record<string, unknown>).task_output).toBe(true);
  });

  it('handles edge case: empty shared_capabilities', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Empty', 'user-1');
    const group = await createGroup(app, 'Empty Cap Group', team.id);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${group.id}/contract`,
      payload: {
        contract: {
          shared_capabilities: [],
          authorization: 'manual',
          trust_threshold: 0,
        },
      },
    });
    expect(patchRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/contract`,
    });
    const body = JSON.parse(getRes.payload);
    expect(body.contract.shared_capabilities).toEqual([]);
    expect(body.contract.trust_threshold).toBe(0);
  });

  it('handles edge case: trust_threshold = 0', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Zero', 'user-1');
    const group = await createGroup(app, 'Zero Threshold', team.id);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${group.id}/contract`,
      payload: {
        contract: {
          authorization: 'auto',
          trust_threshold: 0,
        },
      },
    });
    expect(patchRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/contract`,
    });
    const body = JSON.parse(getRes.payload);
    expect(body.contract.trust_threshold).toBe(0);
  });
});
