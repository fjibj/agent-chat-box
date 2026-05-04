import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, createTestMachine, createTestAgent, getDefaultChannelId } from '../helpers.js';
import { createTask, getTask, updateTask, claimTask, createSubtasks, checkParentCompletion, getTasksByChannel, getTasksByAgent } from '../../packages/server/src/modules/task-queue.js';
import { createDatabase, getDatabase } from '../../packages/server/src/db/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let channelId: string;
let agentId: string;

beforeAll(async () => {
  app = await createTestApp();
  channelId = await getDefaultChannelId(app);
  const machine = await createTestMachine(app, 'unit-test-machine');
  const agent = await createTestAgent(app, machine.id, 'unit-test-agent', 'claude');
  agentId = agent.id;
});

afterAll(async () => {
  await app.close();
});

describe('task-queue: createTask', () => {
  it('creates a task with defaults', () => {
    const task = createTask({ channelId, title: 'Unit test task' }, agentId);
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Unit test task');
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('normal');
    expect(task.mode).toBe('compete');
    expect(task.creatorId).toBe(agentId);
    expect(task.timeoutSeconds).toBe(3600);
    expect(task.maxRetries).toBe(0);
    expect(task.createdAt).toBeGreaterThan(0);
  });

  it('creates a task with custom values', () => {
    const task = createTask({
      channelId,
      title: 'Custom task',
      description: 'With description',
      priority: 'urgent',
      mode: 'collaborate',
      tags: ['test'],
      requiredCapabilities: ['python'],
      timeoutSeconds: 600,
      maxRetries: 3,
    }, agentId);

    expect(task.priority).toBe('urgent');
    expect(task.mode).toBe('collaborate');
    expect(task.tags).toEqual(['test']);
    expect(task.requiredCapabilities).toEqual(['python']);
    expect(task.timeoutSeconds).toBe(600);
    expect(task.maxRetries).toBe(3);
  });
});

describe('task-queue: getTask', () => {
  it('returns task by id', () => {
    const created = createTask({ channelId, title: 'Get test' }, agentId);
    const fetched = getTask(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.title).toBe('Get test');
  });

  it('returns null for nonexistent', () => {
    expect(getTask('nonexistent')).toBeNull();
  });
});

describe('task-queue: updateTask', () => {
  it('updates task status', () => {
    const task = createTask({ channelId, title: 'Update test' }, agentId);
    const updated = updateTask(task.id, { status: 'running' });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('running');
  });

  it('sets completedAt on completion', () => {
    const task = createTask({ channelId, title: 'Complete test' }, agentId);
    const updated = updateTask(task.id, { status: 'completed', output: 'done' });
    expect(updated!.status).toBe('completed');
    expect(updated!.output).toBe('done');
    expect(updated!.completedAt).toBeDefined();
    expect(updated!.completedAt!).toBeGreaterThan(0);
  });

  it('returns null for nonexistent', () => {
    expect(updateTask('nonexistent', { status: 'completed' })).toBeNull();
  });
});

describe('task-queue: claimTask', () => {
  it('claims a pending task', () => {
    const task = createTask({ channelId, title: 'Claim test' }, agentId);
    const result = claimTask(task.id, agentId);
    expect(result.success).toBe(true);
    expect(result.task!.status).toBe('claimed');
    expect(result.task!.assigneeId).toBe(agentId);
    expect(result.task!.claimedAt).toBeDefined();
  });

  it('rejects claim on already claimed task', () => {
    const task = createTask({ channelId, title: 'Double claim test' }, agentId);
    claimTask(task.id, agentId);
    const result = claimTask(task.id, 'other-agent');
    expect(result.success).toBe(false);
    expect(result.error).toBe('ALREADY_CLAIMED');
  });

  it('rejects claim on nonexistent task', () => {
    const result = claimTask('nonexistent', agentId);
    expect(result.success).toBe(false);
    expect(result.error).toBe('NOT_FOUND');
  });

  it('checks capability match', () => {
    const task = createTask({
      channelId,
      title: 'Capability test',
      requiredCapabilities: ['rust'],
    }, agentId);

    // Agent doesn't have 'rust' capability
    const result = claimTask(task.id, agentId);
    expect(result.success).toBe(false);
    expect(result.error).toBe('CAPABILITY_MISMATCH');
  });
});

describe('task-queue: createSubtasks', () => {
  it('creates subtasks linked to parent', () => {
    const parent = createTask({ channelId, title: 'Parent task', mode: 'collaborate' }, agentId);

    const subtasks = createSubtasks(parent.id, [
      { channelId, title: 'Subtask 1', creatorId: agentId },
      { channelId, title: 'Subtask 2', creatorId: agentId, assigneeId: agentId, mode: 'assign' },
    ]);

    expect(subtasks.length).toBe(2);
    expect(subtasks[0].parentTaskId).toBe(parent.id);
    expect(subtasks[0].status).toBe('pending');
    expect(subtasks[1].parentTaskId).toBe(parent.id);
    expect(subtasks[1].status).toBe('claimed');
    expect(subtasks[1].assigneeId).toBe(agentId);
  });
});

describe('task-queue: checkParentCompletion', () => {
  it('moves parent to verifying when all subtasks done', () => {
    const parent = createTask({ channelId, title: 'Parent complete test', mode: 'collaborate' }, agentId);
    const subtasks = createSubtasks(parent.id, [
      { channelId, title: 'Sub A', creatorId: agentId },
      { channelId, title: 'Sub B', creatorId: agentId },
    ]);

    // Complete both subtasks
    updateTask(subtasks[0].id, { status: 'completed' });
    updateTask(subtasks[1].id, { status: 'completed' });

    checkParentCompletion(parent.id);

    const updated = getTask(parent.id);
    expect(updated!.status).toBe('verifying');
  });

  it('completes parent after verification passes', () => {
    const parent = createTask({ channelId, title: 'Parent verify test', mode: 'collaborate' }, agentId);
    const subtasks = createSubtasks(parent.id, [
      { channelId, title: 'Sub C', creatorId: agentId },
    ]);

    updateTask(subtasks[0].id, { status: 'completed' });
    checkParentCompletion(parent.id);

    const verifying = getTask(parent.id);
    expect(verifying!.status).toBe('verifying');

    // Simulate verification pass
    updateTask(parent.id, { status: 'completed', output: 'Verified OK' });
    const completed = getTask(parent.id);
    expect(completed!.status).toBe('completed');
  });

  it('does not complete parent when subtasks remain', () => {
    const parent = createTask({ channelId, title: 'Parent partial test', mode: 'collaborate' }, agentId);
    const subtasks = createSubtasks(parent.id, [
      { channelId, title: 'Sub X', creatorId: agentId },
      { channelId, title: 'Sub Y', creatorId: agentId },
    ]);

    updateTask(subtasks[0].id, { status: 'completed' });
    // Sub Y still pending

    checkParentCompletion(parent.id);

    const updated = getTask(parent.id);
    expect(updated!.status).toBe('pending');
  });
});

describe('task-queue: getTasksByChannel', () => {
  it('returns tasks for channel', () => {
    const channelTasks = getTasksByChannel(channelId);
    expect(channelTasks.length).toBeGreaterThan(0);
    expect(channelTasks.every(t => t.channelId === channelId)).toBe(true);
  });

  it('filters by status', () => {
    const pending = getTasksByChannel(channelId, 'pending');
    expect(pending.every(t => t.status === 'pending')).toBe(true);
  });
});

describe('task-queue: getTasksByAgent', () => {
  it('returns assigned tasks for agent', () => {
    const task = createTask({ channelId, title: 'Agent task' }, agentId);
    claimTask(task.id, agentId);

    const agentTasks = getTasksByAgent(agentId);
    expect(agentTasks.length).toBeGreaterThan(0);
    expect(agentTasks.some(t => t.id === task.id)).toBe(true);
  });
});
