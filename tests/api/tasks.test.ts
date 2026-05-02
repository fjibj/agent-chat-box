import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, createTestMachine, createTestAgent, getDefaultChannelId } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let channelId: string;
let machineId: string;
let agentId: string;

beforeAll(async () => {
  app = await createTestApp();
  channelId = await getDefaultChannelId(app);
  const machine = await createTestMachine(app, 'task-test-machine');
  machineId = machine.id;
  const agent = await createTestAgent(app, machineId, 'task-test-agent', 'claude');
  agentId = agent.id;
});

afterAll(async () => {
  await app.close();
});

describe('Task API', () => {
  let taskId: string;

  it('POST /api/tasks — create task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        channelId,
        title: 'Fix login bug',
        description: 'Login returns 500 on invalid email',
        priority: 'high',
        mode: 'compete',
        creatorId: agentId,
        tags: ['bug', 'auth'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe('Fix login bug');
    expect(body.status).toBe('pending');
    expect(body.priority).toBe('high');
    expect(body.mode).toBe('compete');
    taskId = body.id;
  });

  it('POST /api/tasks — reject missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'No channel' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/tasks — list tasks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(200);
    const { tasks } = res.json();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    const found = tasks.find((t: any) => t.id === taskId);
    expect(found).toBeDefined();
  });

  it('GET /api/tasks?status=pending — filter by status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks?status=pending' });
    expect(res.statusCode).toBe(200);
    const { tasks } = res.json();
    expect(tasks.every((t: any) => t.status === 'pending')).toBe(true);
  });

  it('GET /api/tasks/:id — get single task', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/tasks/${taskId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(taskId);
    expect(body.title).toBe('Fix login bug');
    expect(body.tags).toContain('bug');
  });

  it('GET /api/tasks/:id — 404 for nonexistent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /api/tasks/:id — update task status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      payload: { status: 'completed', output: 'Fixed in commit abc123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('completed');
    expect(body.output).toBe('Fixed in commit abc123');
    expect(body.completedAt).toBeDefined();
  });

  it('PATCH /api/tasks/:id — 404 for nonexistent', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/nonexistent',
      payload: { status: 'completed' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/channels/:channelId/tasks — tasks by channel', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/channels/${channelId}/tasks` });
    expect(res.statusCode).toBe(200);
    const { tasks } = res.json();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/tasks/:id/timeline — task timeline', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/tasks/${taskId}/timeline` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.task).toBeDefined();
    expect(body.timeline).toBeDefined();
    expect(Array.isArray(body.timeline)).toBe(true);
    // Should have at least task.created event
    const created = body.timeline.find((e: any) => e.type === 'task.created');
    expect(created).toBeDefined();
  });
});

describe('Task Claim Flow', () => {
  let pendingTaskId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        channelId,
        title: 'Claimable task',
        mode: 'compete',
        creatorId: agentId,
      },
    });
    pendingTaskId = res.json().id;
  });

  it('POST /api/tasks/:id/claim — claim a pending task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/tasks/${pendingTaskId}/claim`,
      payload: { agentId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.task.status).toBe('claimed');
    expect(body.task.assigneeId).toBe(agentId);
  });

  it('POST /api/tasks/:id/claim — reject double claim', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/tasks/${pendingTaskId}/claim`,
      payload: { agentId: 'some-other-agent' },
    });
    expect(res.statusCode).toBe(409);
  });
});
