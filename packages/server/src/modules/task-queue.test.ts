import { describe, it, expect, vi } from 'vitest';
import { buildApp, createTeam, createMachine, createAgent, createGroup } from '../test-helpers.js';
import {
  getTask,
  createTask,
  claimTask,
  assignTask,
  updateTask,
  createSubtasks,
  getTaskTree,
  checkParentCompletion,
  getTasksByChannel,
  getTasksByAgent,
  checkTimeouts,
} from './task-queue.js';

// Automate: Unit Tests for Task Queue Core Logic
// Covers P0-P2 stories: G011, G013, G014, G016

describe('Task Queue Unit Tests', () => {
  describe('createTask', () => {
    it('creates a pending task in compete mode', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      const task = createTask(
        { channelId, title: 'Test Task', description: 'Desc', mode: 'compete' },
        'user-1',
      );

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
      expect(task.mode).toBe('compete');
      expect(task.channelId).toBe(channelId);
    });

    it('creates a claimed task in assign mode with assignee', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask(
        { channelId, title: 'Assigned Task', mode: 'assign', assigneeId: agent.id },
        'user-1',
      );

      expect(task.status).toBe('claimed');
      expect(task.assigneeId).toBe(agent.id);
      expect(task.claimedAt).toBeDefined();
    });

    it('sets default priority to normal', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      const task = createTask({ channelId, title: 'Priority Task' }, 'user-1');
      expect(task.priority).toBe('normal');
    });
  });

  describe('getTask', () => {
    it('returns null for non-existent task', async () => {
      await buildApp();
      const task = getTask('non-existent');
      expect(task).toBeNull();
    });

    it('returns task with correct shape', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      const created = createTask({ channelId, title: 'Get Task' }, 'user-1');
      const fetched = getTask(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.title).toBe('Get Task');
      expect(fetched!.status).toBe('pending');
    });
  });

  describe('claimTask', () => {
    it('claims a pending task', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask({ channelId, title: 'Claim Me' }, 'user-1');
      const result = claimTask(task.id, agent.id);

      expect(result.success).toBe(true);
      expect(result.task!.status).toBe('claimed');
      expect(result.task!.assigneeId).toBe(agent.id);
    });

    it('fails when task not found', async () => {
      await buildApp();
      const result = claimTask('non-existent', 'agent-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });

    it('fails when task already claimed', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent1 = await createAgent(app, machine.id, 'A1', 'claude');
      const agent2 = await createAgent(app, machine.id, 'A2', 'claude');

      const task = createTask({ channelId, title: 'Double Claim' }, 'user-1');
      claimTask(task.id, agent1.id);
      const result = claimTask(task.id, agent2.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_CLAIMED');
    });

    it('fails capability mismatch', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude', ['code']);

      const task = createTask(
        { channelId, title: 'Need Review', requiredCapabilities: ['review'] },
        'user-1',
      );
      const result = claimTask(task.id, agent.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CAPABILITY_MISMATCH');
    });
  });

  describe('assignTask', () => {
    it('assigns a pending task', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask({ channelId, title: 'Assign Me' }, 'user-1');
      const result = assignTask(task.id, agent.id);

      expect(result.success).toBe(true);
      expect(result.task!.status).toBe('claimed');
    });

    it('fails for already claimed task', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent1 = await createAgent(app, machine.id, 'A1', 'claude');
      const agent2 = await createAgent(app, machine.id, 'A2', 'claude');

      const task = createTask({ channelId, title: 'Double Assign' }, 'user-1');
      assignTask(task.id, agent1.id);
      const result = assignTask(task.id, agent2.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_CLAIMED');
    });
  });

  describe('updateTask', () => {
    it('updates task status to completed', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask({ channelId, title: 'Complete Me' }, 'user-1');
      claimTask(task.id, agent.id);

      const updated = updateTask(task.id, { status: 'completed', output: 'Done!' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('completed');
      expect(updated!.output).toBe('Done!');
      expect(updated!.completedAt).toBeDefined();
    });

    it('auto-retries failed task when retries remain', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask(
        { channelId, title: 'Retry Task', maxRetries: 2 },
        'user-1',
      );
      claimTask(task.id, agent.id);

      const updated = updateTask(task.id, { status: 'failed', output: 'Oops' });
      expect(updated).not.toBeNull();
      // After auto-retry, task should be back to pending
      expect(updated!.status).toBe('pending');
      expect(updated!.retryCount).toBe(1);
      expect(updated!.assigneeId).toBeUndefined();
    });

    it('marks task failed when no retries left', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask(
        { channelId, title: 'No Retry', maxRetries: 0 },
        'user-1',
      );
      claimTask(task.id, agent.id);

      const updated = updateTask(task.id, { status: 'failed', output: 'Oops' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('failed');
    });

    it('releases task back to pending', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask({ channelId, title: 'Release Me' }, 'user-1');
      claimTask(task.id, agent.id);

      const updated = updateTask(task.id, { status: 'pending' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('pending');
      expect(updated!.assigneeId).toBeUndefined();
    });

    it('returns null for non-existent task', async () => {
      await buildApp();
      const result = updateTask('non-existent', { status: 'completed' });
      expect(result).toBeNull();
    });
  });

  describe('createSubtasks', () => {
    it('creates subtasks under parent', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      const parent = createTask(
        { channelId, title: 'Parent', mode: 'collaborate' },
        'user-1',
      );

      const subs = createSubtasks(
        parent.id,
        [
          { channelId, title: 'Sub 1', creatorId: 'user-1' },
          { channelId, title: 'Sub 2', creatorId: 'user-1' },
        ],
      );

      expect(subs.length).toBe(2);
      expect(subs[0].parentTaskId).toBe(parent.id);
      expect(subs[0].depth).toBe(1);
    });

    it('caps subtasks at 5', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      const parent = createTask(
        { channelId, title: 'Parent', mode: 'collaborate' },
        'user-1',
      );

      const manySubs = Array.from({ length: 10 }, (_, i) => ({
        channelId,
        title: `Sub ${i}`,
        creatorId: 'user-1',
      }));

      const subs = createSubtasks(parent.id, manySubs);
      expect(subs.length).toBe(5);
    });

    it('returns empty for non-existent parent', async () => {
      await buildApp();
      const subs = createSubtasks('non-existent', [
        { channelId: 'ch-1', title: 'Orphan', creatorId: 'user-1' },
      ]);
      expect(subs.length).toBe(0);
    });

    it('prevents subtasks beyond max depth', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      const depth0 = createTask({ channelId, title: 'Depth 0', mode: 'collaborate' }, 'user-1');
      const depth1 = createSubtasks(depth0.id, [{ channelId, title: 'Depth 1', creatorId: 'user-1' }]);
      const depth2 = createSubtasks(depth1[0].id, [{ channelId, title: 'Depth 2', creatorId: 'user-1' }]);
      const depth3 = createSubtasks(depth2[0].id, [{ channelId, title: 'Depth 3', creatorId: 'user-1' }]);

      // At depth 3, subtasks should be empty (max depth = 3, childDepth = 3 + 1 = 4 >= MAX_DEPTH)
      expect(depth3.length).toBe(0);
    });
  });

  describe('getTaskTree', () => {
    it('returns task with children', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      const parent = createTask({ channelId, title: 'Tree Parent', mode: 'collaborate' }, 'user-1');
      const subs = createSubtasks(parent.id, [
        { channelId, title: 'Child 1', creatorId: 'user-1' },
        { channelId, title: 'Child 2', creatorId: 'user-1' },
      ]);

      const tree = getTaskTree(parent.id);
      expect(tree).not.toBeNull();
      expect(tree!.task.id).toBe(parent.id);
      expect(tree!.children.length).toBe(2);
    });

    it('returns null for non-existent task', async () => {
      await buildApp();
      const tree = getTaskTree('non-existent');
      expect(tree).toBeNull();
    });
  });

  describe('getTasksByChannel', () => {
    it('returns tasks for a channel', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();

      createTask({ channelId, title: 'Task 1' }, 'user-1');
      createTask({ channelId, title: 'Task 2' }, 'user-1');

      const tasks = getTasksByChannel(channelId);
      expect(tasks.length).toBe(2);
    });

    it('filters by status', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const t1 = createTask({ channelId, title: 'Pending' }, 'user-1');
      const t2 = createTask({ channelId, title: 'Claimed' }, 'user-1');
      claimTask(t2.id, agent.id);

      const pending = getTasksByChannel(channelId, 'pending');
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(t1.id);
    });
  });

  describe('getTasksByAgent', () => {
    it('returns active tasks for an agent', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask({ channelId, title: 'Agent Task' }, 'user-1');
      claimTask(task.id, agent.id);

      const tasks = getTasksByAgent(agent.id);
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe(task.id);
    });

    it('returns empty for agent with no tasks', async () => {
      await buildApp();
      const tasks = getTasksByAgent('no-agent');
      expect(tasks.length).toBe(0);
    });
  });

  describe('checkTimeouts', () => {
    it('retries timed-out task with remaining retries', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask(
        { channelId, title: 'Timeout Task', timeoutSeconds: 1, maxRetries: 1 },
        'user-1',
      );
      claimTask(task.id, agent.id);

      // Wait for timeout
      await new Promise((r) => setTimeout(r, 1100));

      checkTimeouts();

      const after = getTask(task.id);
      expect(after!.status).toBe('pending');
      expect(after!.retryCount).toBe(1);
    });

    it('marks failed when no retries left', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      const task = createTask(
        { channelId, title: 'Timeout No Retry', timeoutSeconds: 1, maxRetries: 0 },
        'user-1',
      );
      claimTask(task.id, agent.id);

      await new Promise((r) => setTimeout(r, 1100));
      checkTimeouts();

      const after = getTask(task.id);
      expect(after!.status).toBe('failed');
    });
  });
});
