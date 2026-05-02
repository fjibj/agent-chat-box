import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, createTestMachine } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let machineId: string;

beforeAll(async () => {
  app = await createTestApp();
  const machine = await createTestMachine(app, 'agent-test-machine');
  machineId = machine.id;
});

afterAll(async () => {
  await app.close();
});

describe('Agent API', () => {
  let agentId: string;

  it('POST /api/agents — create agent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { machineId, name: 'Claude Worker', runtime: 'claude', capabilities: ['typescript', 'python'] },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Claude Worker');
    expect(body.runtime).toBe('claude');
    expect(body.capabilities).toEqual(['typescript', 'python']);
    agentId = body.id;
  });

  it('POST /api/agents — reject missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { name: 'No Machine' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/agents — reject invalid runtime', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { machineId, name: 'Bad Runtime', runtime: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/agents — reject nonexistent machine', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { machineId: 'fake-id', name: 'No Machine', runtime: 'claude' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/agents — list agents', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(res.statusCode).toBe(200);
    const { agents } = res.json();
    expect(agents.length).toBeGreaterThanOrEqual(1);
    const found = agents.find((a: any) => a.id === agentId);
    expect(found).toBeDefined();
  });

  it('GET /api/agents?machineId= — filter by machine', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/agents?machineId=${machineId}` });
    expect(res.statusCode).toBe(200);
    const { agents } = res.json();
    expect(agents.every((a: any) => a.machineId === machineId)).toBe(true);
  });

  it('GET /api/agents/:id — get single agent', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/agents/${agentId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(agentId);
    expect(body.name).toBe('Claude Worker');
    expect(body.roleCard).toBeDefined();
  });

  it('GET /api/agents/:id — 404 for nonexistent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /api/agents/:id — update agent', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agentId}`,
      payload: { name: 'Renamed Agent', description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Verify update
    const getRes = await app.inject({ method: 'GET', url: `/api/agents/${agentId}` });
    const body = getRes.json();
    expect(body.name).toBe('Renamed Agent');
    expect(body.roleCard.description).toBe('Updated description');
  });

  it('PATCH /api/agents/:id — reject empty update', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agentId}`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /api/agents/:id — delete agent', async () => {
    // Create one to delete
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { machineId, name: 'To Delete', runtime: 'codex' },
    });
    const { id } = createRes.json();

    const res = await app.inject({ method: 'DELETE', url: `/api/agents/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const getRes = await app.inject({ method: 'GET', url: `/api/agents/${id}` });
    expect(getRes.statusCode).toBe(404);
  });
});
