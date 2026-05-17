import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../test-helpers.js';

describe('Machines API', () => {
  describe('POST /api/machines', () => {
    it('creates a machine with API key', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/machines',
        payload: { name: 'test-machine' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('test-machine');
      expect(body.apiKey).toMatch(/^sk_/);
    });

    it('rejects missing name', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/machines',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('name is required');
    });

    it('rejects empty name', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/machines',
        payload: { name: '   ' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/machines', () => {
    it('lists machines without api keys', async () => {
      const { app } = await buildApp();
      // Create a machine first
      await app.inject({ method: 'POST', url: '/api/machines', payload: { name: 'm1' } });

      const res = await app.inject({ method: 'GET', url: '/api/machines' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.machines).toBeInstanceOf(Array);
      expect(body.machines.length).toBeGreaterThanOrEqual(1);
      expect(body.machines[0].apiKey).toBeUndefined();
      expect(body.machines[0].status).toBe('offline');
    });
  });

  describe('GET /api/machines/:id', () => {
    it('returns machine details', async () => {
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/machines',
        payload: { name: 'm-detail' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'GET', url: `/api/machines/${id}` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(id);
      expect(body.name).toBe('m-detail');
    });

    it('returns 404 for non-existent machine', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/machines/non-existent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/machines/:id', () => {
    it('renames a machine', async () => {
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/machines',
        payload: { name: 'old-name' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/machines/${id}`,
        payload: { name: 'new-name' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.name).toBe('new-name');
    });

    it('returns 404 for non-existent machine', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/machines/non-existent',
        payload: { name: 'new-name' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects empty name', async () => {
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/machines',
        payload: { name: 'm1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/machines/${id}`,
        payload: { name: '   ' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/machines/:id', () => {
    it('deletes a machine', async () => {
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/machines',
        payload: { name: 'to-delete' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'DELETE', url: `/api/machines/${id}` });
      expect(res.statusCode).toBe(200);

      const getRes = await app.inject({ method: 'GET', url: `/api/machines/${id}` });
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 for non-existent machine', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: '/api/machines/non-existent' });
      expect(res.statusCode).toBe(404);
    });
  });
});
