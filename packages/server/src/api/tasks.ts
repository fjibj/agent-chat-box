import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createTask, getTask, updateTask, claimTask, assignTask, getTasksByChannel, getTasksByAgent, getTaskTree, checkParentCompletion } from '../modules/task-queue.js';
import { getDatabase } from '../db/index.js';
import type { Task } from '@agent-chat-box/shared';

/** Register task API routes */
export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  console.log('[tasks] Registering task routes...');

  // POST /api/tasks — create task
  app.post('/api/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      channelId?: string;
      title?: string;
      description?: string;
      priority?: Task['priority'];
      mode?: Task['mode'];
      assigneeId?: string;
      tags?: string[];
      requiredCapabilities?: string[];
      timeoutSeconds?: number;
      maxRetries?: number;
      creatorId?: string;
    };

    if (!body.channelId || !body.title || !body.creatorId) {
      return reply.status(400).send({ error: 'channelId, title, and creatorId are required' });
    }

    const task = createTask(
      {
        channelId: body.channelId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        mode: body.mode,
        assigneeId: body.assigneeId,
        tags: body.tags,
        requiredCapabilities: body.requiredCapabilities,
        timeoutSeconds: body.timeoutSeconds,
        maxRetries: body.maxRetries,
      },
      body.creatorId
    );

    return reply.status(201).send(task);
  });

  // GET /api/tasks — list all tasks
  app.get('/api/tasks', async (request: FastifyRequest) => {
    const query = request.query as { status?: string };
    const db = getDatabase();
    let sql = 'SELECT id, channel_id, title, description, priority, mode, status, assignee_id, creator_id, tags, required_capabilities, timeout_seconds, max_retries, output, parent_task_id, depth, created_at, claimed_at, completed_at FROM tasks';
    const params: unknown[] = [];

    if (query.status) {
      sql += ' WHERE status = ?';
      params.push(query.status);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }

    const tasks: Task[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      tasks.push({
        id: row.id as string,
        channelId: row.channel_id as string,
        title: row.title as string,
        description: row.description as string | undefined,
        priority: row.priority as Task['priority'],
        mode: row.mode as Task['mode'],
        status: row.status as Task['status'],
        assigneeId: row.assignee_id as string | undefined,
        creatorId: row.creator_id as string,
        tags: row.tags ? JSON.parse(row.tags as string) : [],
        requiredCapabilities: row.required_capabilities ? JSON.parse(row.required_capabilities as string) : [],
        timeoutSeconds: (row.timeout_seconds as number) || 300,
        maxRetries: (row.max_retries as number) || 0,
        retryCount: 0,
        output: row.output as string | undefined,
        parentTaskId: row.parent_task_id as string | undefined,
        depth: (row.depth as number) ?? 0,
        createdAt: (row.created_at as number) || 0,
        claimedAt: row.claimed_at as number | undefined,
        completedAt: row.completed_at as number | undefined,
      });
    }
    stmt.free();

    return { tasks };
  });

  // GET /api/tasks/:id — get task
  app.get('/api/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const task = getTask(id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    return task;
  });

  // PATCH /api/tasks/:id — update task
  app.patch('/api/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status?: Task['status']; output?: string };

    const task = updateTask(id, body);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Check parent completion when subtask finishes
    if ((body.status === 'completed' || body.status === 'failed') && task.parentTaskId) {
      checkParentCompletion(task.parentTaskId);
    }

    return task;
  });

  // POST /api/tasks/:id/claim — claim a task (compete mode)
  app.post('/api/tasks/:id/claim', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { agentId?: string };

    if (!body.agentId) {
      return reply.status(400).send({ error: 'agentId is required' });
    }

    const result = claimTask(id, body.agentId);
    if (!result.success) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'ALREADY_CLAIMED' ? 409 : 400;
      return reply.status(status).send(result);
    }

    return result;
  });

  // POST /api/tasks/:id/assign — directly assign a task (assign mode)
  app.post('/api/tasks/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { agentId?: string };

    if (!body.agentId) {
      return reply.status(400).send({ error: 'agentId is required' });
    }

    const result = assignTask(id, body.agentId);
    if (!result.success) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'ALREADY_CLAIMED' ? 409 : 400;
      return reply.status(status).send(result);
    }

    return result;
  });

  // GET /api/channels/:channelId/tasks — get tasks by channel
  app.get('/api/channels/:channelId/tasks', async (request: FastifyRequest) => {
    const { channelId } = request.params as { channelId: string };
    const query = request.query as { status?: Task['status'] };
    const tasks = getTasksByChannel(channelId, query.status);
    return { tasks };
  });

  // GET /api/agents/:agentId/tasks — get tasks by agent
  app.get('/api/agents/:agentId/tasks', async (request: FastifyRequest) => {
    const { agentId } = request.params as { agentId: string };
    const tasks = getTasksByAgent(agentId);
    return { tasks };
  });

  // GET /api/tasks/:id/timeline — get task timeline
  app.get('/api/tasks/:id/timeline', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const task = getTask(id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    const db = getDatabase();
    const timeline: Array<{ type: string; timestamp: number; data: unknown }> = [];

    // Task creation
    timeline.push({
      type: 'task.created',
      timestamp: task.createdAt,
      data: { taskId: task.id, title: task.title, creatorId: task.creatorId },
    });

    // Task claimed
    if (task.claimedAt) {
      timeline.push({
        type: 'task.claimed',
        timestamp: task.claimedAt,
        data: { taskId: task.id, assigneeId: task.assigneeId },
      });
    }

    // Task completed/failed
    if (task.completedAt) {
      timeline.push({
        type: task.status === 'completed' ? 'task.completed' : 'task.failed',
        timestamp: task.completedAt,
        data: { taskId: task.id, output: task.output },
      });
    }

    // Related messages in the channel
    const stmt = db.prepare(
      'SELECT id, channel_id, sender_id, sender_kind, content, mentions, reply_to, attachments, created_at FROM messages WHERE channel_id = ? ORDER BY created_at ASC'
    );
    stmt.bind([task.channelId]);

    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      timeline.push({
        type: 'message',
        timestamp: row.created_at as number,
        data: {
          id: row.id,
          senderId: row.sender_id,
          senderKind: row.sender_kind,
          content: row.content,
        },
      });
    }
    stmt.free();

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return { task, timeline };
  });

  // GET /api/tasks/:id/tree — get task with all descendants
  app.get('/api/tasks/:id/tree', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tree = getTaskTree(id);
    if (!tree) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    return tree;
  });

  // POST /api/tasks/:id/force-complete — force complete a task
  app.post('/api/tasks/:id/force-complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const task = getTask(id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    if (task.status === 'completed') {
      return reply.status(409).send({ error: 'Already completed' });
    }

    const updated = updateTask(id, { status: 'completed', output: task.output || 'Force completed by admin' });
    return updated;
  });

  // POST /api/tasks/:id/force-fail — force fail a task (triggers retry if available)
  app.post('/api/tasks/:id/force-fail', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const task = getTask(id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    if (task.status === 'failed') {
      return reply.status(409).send({ error: 'Already failed' });
    }

    const updated = updateTask(id, { status: 'failed', output: 'Force failed by admin' });
    return updated;
  });

  // POST /api/tasks/:id/subtasks — create subtasks (called by daemon after decomposition)
  app.post('/api/tasks/:id/subtasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      subtasks?: Array<{ title: string; description?: string; mode?: 'compete' | 'assign'; assigneeId?: string }>;
      creatorId?: string;
      maxRetries?: number;
    };

    if (!body.subtasks || !Array.isArray(body.subtasks) || body.subtasks.length === 0) {
      return reply.status(400).send({ error: 'subtasks array is required' });
    }
    if (!body.creatorId) {
      return reply.status(400).send({ error: 'creatorId is required' });
    }

    const parentTask = getTask(id);
    if (!parentTask) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Import createSubtasks
    const { createSubtasks } = await import('../modules/task-queue.js');
    const subtaskInputs = body.subtasks.map(st => ({
      channelId: parentTask.channelId,
      title: st.title,
      description: st.description,
      mode: st.mode,
      assigneeId: st.assigneeId,
      creatorId: body.creatorId!,
    }));

    const created = createSubtasks(id, subtaskInputs, body.maxRetries);

    // Update parent status to decomposing → running (subtasks now executing)
    updateTask(id, { status: 'running' });

    return { subtasks: created };
  });

  console.log('[tasks] Task routes registered');
}
