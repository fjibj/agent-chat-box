import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('Channel API', () => {
  it('GET /api/channels — default #general exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels' });
    expect(res.statusCode).toBe(200);
    const { channels } = res.json();
    expect(channels.length).toBeGreaterThanOrEqual(1);
    const general = channels.find((c: any) => c.name === 'general');
    expect(general).toBeDefined();
    expect(general.type).toBe('group');
  });

  it('POST /api/channels — create channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'dev-team', description: 'Development team chat' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('dev-team');
    expect(body.type).toBe('group');
  });

  it('POST /api/channels — create with type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'task-channel', type: 'task' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().type).toBe('task');
  });

  it('POST /api/channels — reject empty name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/channels — reject invalid type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'bad', type: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/channels/dm — create DM channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels/dm',
      payload: {
        member1Id: 'user-1',
        member1Kind: 'human',
        member2Id: 'agent-1',
        member2Kind: 'agent',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toContain('dm:');
  });

  it('POST /api/channels/dm — same pair returns existing', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/channels/dm',
      payload: {
        member1Id: 'user-2',
        member1Kind: 'human',
        member2Id: 'agent-2',
        member2Kind: 'agent',
      },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/channels/dm',
      payload: {
        member1Id: 'user-2',
        member1Kind: 'human',
        member2Id: 'agent-2',
        member2Kind: 'agent',
      },
    });
    expect(res1.json().id).toBe(res2.json().id);
  });

  it('POST /api/channels/dm — reject missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels/dm',
      payload: { member1Id: 'a' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/channels/:id — get single channel', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/channels' });
    const { channels } = listRes.json();
    const general = channels.find((c: any) => c.name === 'general');

    const res = await app.inject({ method: 'GET', url: `/api/channels/${general.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('general');
  });

  it('GET /api/channels/:id — 404 for nonexistent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/channels/:id — delete channel', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'to-delete' },
    });
    const { id } = createRes.json();

    const res = await app.inject({ method: 'DELETE', url: `/api/channels/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const getRes = await app.inject({ method: 'GET', url: `/api/channels/${id}` });
    expect(getRes.statusCode).toBe(404);
  });
});
