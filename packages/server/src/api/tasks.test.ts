import { describe, it, expect } from 'vitest';
import { buildApp } from '../test-helpers.js';

describe('Tasks API (legacy)', () => {
  describe('POST /api/tasks', () => {
    it('creates a task', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();

      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Test Task', creatorId: 'user-1' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Test Task');
      expect(body.status).toBe('pending');
    });

    it('rejects missing fields', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { title: 'No channel' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('supports compete mode', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();

      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Compete Task', creatorId: 'user-1', mode: 'compete' },
      });
      const body = JSON.parse(res.payload);
      expect(body.mode).toBe('compete');
    });
  });

  describe('GET /api/tasks', () => {
    it('lists all tasks', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'T1', creatorId: 'user-1' },
      });

      const res = await app.inject({ method: 'GET', url: '/api/tasks' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by status', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'T1', creatorId: 'user-1' },
      });

      const res = await app.inject({ method: 'GET', url: '/api/tasks?status=pending' });
      const body = JSON.parse(res.payload);
      expect(body.tasks.every((t: { status: string }) => t.status === 'pending')).toBe(true);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns task details', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Detail Task', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'GET', url: `/api/tasks/${id}` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(id);
      expect(body.title).toBe('Detail Task');
    });

    it('returns 404 for non-existent task', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tasks/non-existent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('updates task status', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Update Task', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${id}`,
        payload: { status: 'completed', output: 'Done!' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('completed');
    });

    it('returns 404 for non-existent task', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tasks/non-existent',
        payload: { status: 'completed' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/tasks/:id/claim', () => {
    it('claims a pending task', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Claim Task', creatorId: 'user-1', mode: 'compete' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${id}/claim`,
        payload: { agentId: 'agent-1' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });

    it('rejects claim without agentId', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'T', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${id}/claim`,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/tasks/:id/assign', () => {
    it('assigns a task to an agent', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Assign Task', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${id}/assign`,
        payload: { agentId: 'agent-1' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });
  });

  describe('GET /api/channels/:channelId/tasks', () => {
    it('returns tasks for a channel', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Channel Task', creatorId: 'user-1' },
      });

      const res = await app.inject({ method: 'GET', url: '/api/channels/ch-1/tasks' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tasks).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/tasks/:id/timeline', () => {
    it('returns task timeline', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Timeline Task', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'GET', url: `/api/tasks/${id}/timeline` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.task).toBeDefined();
      expect(body.timeline).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/tasks/:id/tree', () => {
    it('returns task tree', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Tree Task', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'GET', url: `/api/tasks/${id}/tree` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.task).toBeDefined();
      expect(body.children).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/tasks/:id/force-complete', () => {
    it('force completes a task', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Force Complete', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'POST', url: `/api/tasks/${id}/force-complete` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('completed');
    });

    it('returns 409 for already completed task', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Already Done', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);
      await app.inject({ method: 'POST', url: `/api/tasks/${id}/force-complete` });

      const res = await app.inject({ method: 'POST', url: `/api/tasks/${id}/force-complete` });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('POST /api/tasks/:id/force-fail', () => {
    it('force fails a task', async () => {
      const { app, db } = await buildApp();
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', ['ch-1', '#test', 0]);
      db.save();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { channelId: 'ch-1', title: 'Force Fail', creatorId: 'user-1' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'POST', url: `/api/tasks/${id}/force-fail` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('failed');
    });
  });
});
