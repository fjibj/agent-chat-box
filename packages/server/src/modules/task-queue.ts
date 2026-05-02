import crypto from 'crypto';
import { getDatabase } from '../db/index.js';
import type { Task, CreateTaskInput, UpdateTaskInput, ClaimResult } from '@agent-chat-box/shared';
import { broadcastToChannel } from '../ws/handler.js';
import { TASK_TIMEOUT_CHECK_INTERVAL_MS } from '@agent-chat-box/shared';

/** Get task by ID */
export function getTask(taskId: string): Task | null {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT id, channel_id, title, description, priority, mode, status, tags, creator_id, assignee_id, parent_task_id, required_capabilities, output, timeout_seconds, max_retries, retry_count, created_at, claimed_at, completed_at FROM tasks WHERE id = ?'
  );
  stmt.bind([taskId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();

  return {
    id: row.id as string,
    channelId: row.channel_id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    priority: row.priority as Task['priority'],
    mode: row.mode as Task['mode'],
    status: row.status as Task['status'],
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
    creatorId: row.creator_id as string,
    assigneeId: row.assignee_id as string | undefined,
    parentTaskId: row.parent_task_id as string | undefined,
    requiredCapabilities: row.required_capabilities ? JSON.parse(row.required_capabilities as string) : undefined,
    output: row.output as string | undefined,
    timeoutSeconds: row.timeout_seconds as number,
    maxRetries: row.max_retries as number,
    retryCount: row.retry_count as number,
    createdAt: row.created_at as number,
    claimedAt: row.claimed_at as number | undefined,
    completedAt: row.completed_at as number | undefined,
  };
}

/** Create a new task */
export function createTask(input: CreateTaskInput, creatorId: string): Task {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO tasks (id, channel_id, title, description, priority, mode, tags, creator_id, required_capabilities, timeout_seconds, max_retries, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.channelId,
      input.title,
      input.description || null,
      input.priority || 'normal',
      input.mode || 'compete',
      input.tags ? JSON.stringify(input.tags) : null,
      creatorId,
      input.requiredCapabilities ? JSON.stringify(input.requiredCapabilities) : null,
      input.timeoutSeconds || 3600,
      input.maxRetries || 0,
      now,
    ]
  );
  db.save();

  const task = getTask(id)!;

  // Broadcast to channel
  broadcastToChannel(input.channelId, 'task.created', { task });

  return task;
}

/** Claim a task (compete mode) */
export function claimTask(taskId: string, agentId: string): ClaimResult {
  const db = getDatabase();
  const now = Date.now();

  // Check task exists and get requirements
  const task = getTask(taskId);
  if (!task) return { success: false, error: 'NOT_FOUND' };
  if (task.status !== 'pending') return { success: false, error: 'ALREADY_CLAIMED', claimedBy: task.assigneeId };

  // Check capability match
  if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
    const agentStmt = db.prepare('SELECT capabilities FROM agents WHERE id = ?');
    agentStmt.bind([agentId]);
    if (!agentStmt.step()) {
      agentStmt.free();
      return { success: false, error: 'NOT_FOUND' };
    }
    const agentRow = agentStmt.getAsObject() as { capabilities: string };
    agentStmt.free();

    const agentCapabilities: string[] = JSON.parse(agentRow.capabilities || '[]');
    const hasAll = task.requiredCapabilities.every(cap => agentCapabilities.includes(cap));
    if (!hasAll) {
      return { success: false, error: 'CAPABILITY_MISMATCH' };
    }
  }

  // Atomic claim
  db.run('BEGIN TRANSACTION');
  try {
    db.run(
      `UPDATE tasks SET status = 'claimed', assignee_id = ?, claimed_at = ?
       WHERE id = ? AND status = 'pending'`,
      [agentId, now, taskId]
    );

    const result = db.exec('SELECT changes() as changes');
    const changes = result[0]?.values[0][0] as number;

    if (changes === 0) {
      db.run('ROLLBACK');
      const task = getTask(taskId);
      if (!task) return { success: false, error: 'NOT_FOUND' };
      if (task.status !== 'pending') return { success: false, error: 'ALREADY_CLAIMED', claimedBy: task.assigneeId };
      return { success: false, error: 'ALREADY_CLAIMED' };
    }

    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  db.save();

  const claimedTask = getTask(taskId)!;

  // Broadcast
  broadcastToChannel(claimedTask.channelId, 'task.claimed', {
    taskId,
    agentId,
    claimedAt: now,
  });

  return { success: true, task: claimedTask };
}

/** Update task status */
export function updateTask(taskId: string, input: UpdateTaskInput): Task | null {
  const db = getDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.status) {
    sets.push('status = ?');
    params.push(input.status);
    if (input.status === 'completed') {
      sets.push('completed_at = ?');
      params.push(Date.now());
    }
  }
  if (input.output !== undefined) {
    sets.push('output = ?');
    params.push(input.output);
  }

  if (sets.length === 0) return getTask(taskId);

  params.push(taskId);
  db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);
  db.save();

  const task = getTask(taskId);
  if (task) {
    broadcastToChannel(task.channelId, `task.${input.status || 'updated'}`, { task });
  }

  return task;
}

/** Create subtasks for collaborative mode */
export function createSubtasks(parentTaskId: string, subtasks: Array<{ channelId: string; title: string; description?: string; assigneeId?: string; creatorId: string }>): Task[] {
  const db = getDatabase();
  const createdTasks: Task[] = [];

  for (const st of subtasks) {
    const id = crypto.randomUUID();
    const now = Date.now();

    db.run(
      `INSERT INTO tasks (id, channel_id, title, description, mode, status, creator_id, assignee_id, parent_task_id, created_at)
       VALUES (?, ?, ?, ?, 'collaborate', ?, ?, ?, ?, ?)`,
      [
        id,
        st.channelId,
        st.title,
        st.description || null,
        st.assigneeId ? 'claimed' : 'pending',
        st.creatorId,
        st.assigneeId || null,
        parentTaskId,
        now,
      ]
    );

    createdTasks.push(getTask(id)!);
  }

  db.save();

  // Broadcast subtasks creation
  const parentTask = getTask(parentTaskId);
  if (parentTask) {
    broadcastToChannel(parentTask.channelId, 'task.subtasks', {
      parentTaskId,
      subtasks: createdTasks,
    });
  }

  return createdTasks;
}

/** Check if all subtasks are completed and update parent */
export function checkParentCompletion(parentTaskId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ? AND status != 'completed'"
  );
  stmt.bind([parentTaskId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as { count: number };
    stmt.free();

    if (row.count === 0) {
      updateTask(parentTaskId, { status: 'completed', output: 'All subtasks completed' });
    }
  } else {
    stmt.free();
  }
}

/** Get tasks by channel */
export function getTasksByChannel(channelId: string, status?: Task['status']): Task[] {
  const db = getDatabase();
  let sql = 'SELECT id FROM tasks WHERE channel_id = ?';
  const params: unknown[] = [channelId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';

  const tasks: Task[] = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);

  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    const task = getTask(row.id);
    if (task) tasks.push(task);
  }
  stmt.free();

  return tasks;
}

/** Get tasks assigned to an agent */
export function getTasksByAgent(agentId: string): Task[] {
  const db = getDatabase();
  const tasks: Task[] = [];
  const stmt = db.prepare(
    "SELECT id FROM tasks WHERE assignee_id = ? AND status IN ('claimed', 'running') ORDER BY created_at DESC"
  );
  stmt.bind([agentId]);

  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    const task = getTask(row.id);
    if (task) tasks.push(task);
  }
  stmt.free();

  return tasks;
}

/** Check for timed out tasks and handle retries */
export function checkTimeouts(): void {
  const db = getDatabase();
  const now = Date.now();

  // Find expired tasks
  const stmt = db.prepare(`
    SELECT id, channel_id, retry_count, max_retries
    FROM tasks
    WHERE status IN ('claimed', 'running')
    AND (claimed_at + timeout_seconds * 1000) < ?
  `);
  stmt.bind([now]);

  const expiredTasks: Array<{ id: string; channel_id: string; retry_count: number; max_retries: number }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; channel_id: string; retry_count: number; max_retries: number };
    expiredTasks.push(row);
  }
  stmt.free();

  for (const task of expiredTasks) {
    if (task.retry_count < task.max_retries) {
      // Retry: reset to pending
      db.run(
        "UPDATE tasks SET status = 'pending', assignee_id = NULL, retry_count = retry_count + 1 WHERE id = ?",
        [task.id]
      );
      db.save();

      broadcastToChannel(task.channel_id, 'task.retried', {
        taskId: task.id,
        retryCount: task.retry_count + 1,
      });

      console.log(`[task] Task ${task.id} timed out, retrying (attempt ${task.retry_count + 1})`);
    } else {
      // No more retries: mark as failed
      updateTask(task.id, { status: 'failed', output: 'Task timed out' });
      console.log(`[task] Task ${task.id} timed out, no retries left`);
    }
  }
}

let timeoutInterval: ReturnType<typeof setInterval> | null = null;

/** Start the timeout checker */
export function startTimeoutChecker(): void {
  if (timeoutInterval) return;
  timeoutInterval = setInterval(checkTimeouts, TASK_TIMEOUT_CHECK_INTERVAL_MS);
  console.log(`[task] Timeout checker started (interval: ${TASK_TIMEOUT_CHECK_INTERVAL_MS}ms)`);
}

/** Stop the timeout checker */
export function stopTimeoutChecker(): void {
  if (timeoutInterval) {
    clearInterval(timeoutInterval);
    timeoutInterval = null;
    console.log('[task] Timeout checker stopped');
  }
}
