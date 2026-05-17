import { describe, it, expect, vi } from 'vitest';
import { buildApp, createMachine } from '../test-helpers.js';
import { registerAgentWs, getAgentById } from './agents.js';

describe('Agents API', () => {
  describe('POST /api/agents', () => {
    it('creates an agent for a valid machine', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'agent-test-machine');

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'Test Agent', runtime: 'claude' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('Test Agent');
      expect(body.runtime).toBe('claude');
    });

    it('rejects missing fields', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { name: 'A1' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('machineId, name, and runtime are required');
    });

    it('rejects invalid runtime', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'A1', runtime: 'invalid' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for non-existent machine', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: 'non-existent', name: 'A1', runtime: 'claude' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/agents', () => {
    it('lists all agents', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'A1', runtime: 'claude' },
      });

      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.agents).toBeInstanceOf(Array);
      expect(body.agents.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by machineId', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'A1', runtime: 'claude' },
      });

      const res = await app.inject({ method: 'GET', url: `/api/agents?machineId=${machine.id}` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.agents.length).toBe(1);
      expect(body.agents[0].name).toBe('A1');
    });
  });

  describe('GET /api/agents/:id', () => {
    it('returns agent details', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'A1', runtime: 'claude' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'GET', url: `/api/agents/${id}` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(id);
      expect(body.name).toBe('A1');
    });

    it('returns 404 for non-existent agent', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/agents/non-existent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/agents/:id', () => {
    it('updates agent name', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'A1', runtime: 'claude' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/agents/${id}`,
        payload: { name: 'A1-renamed' },
      });
      expect(res.statusCode).toBe(200);

      const getRes = await app.inject({ method: 'GET', url: `/api/agents/${id}` });
      const body = JSON.parse(getRes.payload);
      expect(body.name).toBe('A1-renamed');
    });

    it('returns 404 for non-existent agent', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/agents/non-existent',
        payload: { name: 'X' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects empty update', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'A1', runtime: 'claude' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/agents/${id}`,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/agents/:id', () => {
    it('deletes an agent', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'to-delete', runtime: 'claude' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'DELETE', url: `/api/agents/${id}` });
      expect(res.statusCode).toBe(200);

      const getRes = await app.inject({ method: 'GET', url: `/api/agents/${id}` });
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 for non-existent agent', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: '/api/agents/non-existent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('registerAgentWs', () => {
    it('creates new agent via WebSocket', async () => {
      await buildApp();
      const { app, db } = await buildApp();
      const machine = await createMachine(app, 'ws-machine');

      const agent = registerAgentWs(machine.id, {
        name: 'ws-agent',
        runtime: 'claude',
        roleCard: { name: 'ws-agent', description: '' },
        capabilities: ['typescript'],
      });

      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('ws-agent');
      expect(agent!.status).toBe('awake');
    });

    it('updates existing agent instead of duplicating', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');

      // First registration
      const agent1 = registerAgentWs(machine.id, {
        name: 'dup-agent',
        runtime: 'claude',
        roleCard: { name: 'dup-agent', description: '' },
        capabilities: ['ts'],
      });

      // Second registration with same name/runtime
      const agent2 = registerAgentWs(machine.id, {
        name: 'dup-agent-renamed',
        runtime: 'claude',
        roleCard: { name: 'dup-agent-renamed', description: '' },
        capabilities: ['ts', 'js'],
      });

      expect(agent1!.id).toBe(agent2!.id);
      expect(agent2!.name).toBe('dup-agent-renamed');
    });
  });

  describe('getAgentById', () => {
    it('returns agent for valid id', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'm1');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { machineId: machine.id, name: 'A1', runtime: 'claude' },
      });
      const { id } = JSON.parse(createRes.payload);

      const agent = getAgentById(id);
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('A1');
    });

    it('returns null for non-existent id', async () => {
      await buildApp();
      const agent = getAgentById('non-existent');
      expect(agent).toBeNull();
    });
  });
});
