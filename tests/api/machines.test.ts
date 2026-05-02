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

describe('Machine API', () => {
  let machineId: string;
  let apiKey: string;

  it('POST /api/machines — create machine', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/machines',
      payload: { name: 'Home PC' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Home PC');
    expect(body.apiKey).toMatch(/^sk_/);
    machineId = body.id;
    apiKey = body.apiKey;
  });

  it('POST /api/machines — reject empty name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/machines',
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/machines — reject missing name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/machines',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/machines — list machines', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/machines' });
    expect(res.statusCode).toBe(200);
    const { machines } = res.json();
    expect(Array.isArray(machines)).toBe(true);
    expect(machines.length).toBeGreaterThanOrEqual(1);
    const found = machines.find((m: any) => m.id === machineId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Home PC');
  });

  it('GET /api/machines/:id — get single machine', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/machines/${machineId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(machineId);
    expect(body.name).toBe('Home PC');
    expect(body.createdAt).toBeDefined();
  });

  it('GET /api/machines/:id — 404 for nonexistent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/machines/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/machines/:id — delete machine', async () => {
    // Create a machine to delete
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/machines',
      payload: { name: 'To Delete' },
    });
    const { id } = createRes.json();

    const res = await app.inject({ method: 'DELETE', url: `/api/machines/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Verify deleted
    const getRes = await app.inject({ method: 'GET', url: `/api/machines/${id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /api/machines/:id — 404 for nonexistent', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/machines/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});
