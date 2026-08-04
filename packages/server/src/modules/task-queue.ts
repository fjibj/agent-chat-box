import crypto from 'crypto';
import yaml from 'js-yaml';
import { getDatabase } from '../db/index.js';
import type { Task, CreateTaskInput, UpdateTaskInput, ClaimResult } from '@agent-chat-box/shared';
import { broadcastToChannel, broadcastToGroup, sendTo } from '../ws/handler.js';
import { TASK_TIMEOUT_CHECK_INTERVAL_MS } from '@agent-chat-box/shared';
import { recordReputation } from './reputation.js';

/** Get task by ID */
export function getTask(taskId: string): Task | null {
  const db = getDatabase();
  const stmt = db.prepare(
    `SELECT t.id, t.channel_id, t.title, t.description, t.priority, t.mode, t.status, t.tags, t.creator_id,
            t.assignee_id, t.parent_task_id, t.depth, t.required_capabilities, t.is_group_task,
            t.source_team_id, t.output, t.timeout_seconds, t.max_retries, t.retry_count, t.created_at,
            t.claimed_at, t.completed_at, gt.group_id, gt.source_team_id as gt_source_team_id,
            gt.authorization_status
     FROM tasks t
     LEFT JOIN group_tasks gt ON t.id = gt.task_id
     WHERE t.id = ?`,
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
    description: (row.description as string | null) ?? undefined,
    priority: row.priority as Task['priority'],
    mode: row.mode as Task['mode'],
    status: row.status as Task['status'],
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
    creatorId: row.creator_id as string,
    assigneeId: (row.assignee_id as string | null) ?? undefined,
    parentTaskId: (row.parent_task_id as string | null) ?? undefined,
    depth: (row.depth as number) ?? 0,
    requiredCapabilities: row.required_capabilities
      ? JSON.parse(row.required_capabilities as string)
      : undefined,
    isGroupTask: Boolean(row.is_group_task),
    sourceTeamId:
      (row.gt_source_team_id as string | null) ??
      (row.source_team_id as string | null) ??
      undefined,
    groupId: (row.group_id as string | null) ?? undefined,
    authorizationStatus:
      (row.authorization_status as Task['authorizationStatus'] | null) ?? undefined,
    output: (row.output as string | null) ?? undefined,
    timeoutSeconds: row.timeout_seconds as number,
    maxRetries: row.max_retries as number,
    retryCount: row.retry_count as number,
    createdAt: row.created_at as number,
    claimedAt: (row.claimed_at as number | null) ?? undefined,
    completedAt: (row.completed_at as number | null) ?? undefined,
  };
}

/** Create a new task */
export function createTask(input: CreateTaskInput, creatorId: string): Task {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = Date.now();
  const mode = input.mode || 'compete';

  // For assign/collaborate mode with assigneeId, create as 'claimed' directly
  const initialStatus =
    input.assigneeId && (mode === 'assign' || mode === 'collaborate') ? 'claimed' : 'pending';

  db.run(
    `INSERT INTO tasks (id, channel_id, title, description, priority, mode, status, tags, creator_id, assignee_id, required_capabilities, timeout_seconds, max_retries, created_at, claimed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.channelId,
      input.title,
      input.description || null,
      input.priority || 'normal',
      mode,
      initialStatus,
      input.tags ? JSON.stringify(input.tags) : null,
      creatorId,
      input.assigneeId || null,
      input.requiredCapabilities ? JSON.stringify(input.requiredCapabilities) : null,
      input.timeoutSeconds || 3600,
      input.maxRetries || 0,
      now,
      initialStatus === 'claimed' ? now : null,
    ],
  );
  db.save();

  const task = getTask(id)!;

  // Broadcast to channel
  broadcastToChannel(input.channelId, 'task.created', { task });

  return task;
}

/** Create task with explicit parent and depth */
export function createTaskWithParent(
  input: CreateTaskInput,
  creatorId: string,
  parentTaskId: string,
  depth: number,
): Task {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = Date.now();
  const mode = input.mode || 'compete';
  const initialStatus = mode === 'assign' && input.assigneeId ? 'claimed' : 'pending';

  db.run(
    `INSERT INTO tasks (id, channel_id, title, description, priority, mode, status, tags, creator_id, assignee_id, parent_task_id, depth, required_capabilities, timeout_seconds, max_retries, created_at, claimed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.channelId,
      input.title,
      input.description || null,
      input.priority || 'normal',
      mode,
      initialStatus,
      input.tags ? JSON.stringify(input.tags) : null,
      creatorId,
      input.assigneeId || null,
      parentTaskId,
      depth,
      input.requiredCapabilities ? JSON.stringify(input.requiredCapabilities) : null,
      input.timeoutSeconds || 3600,
      input.maxRetries || 0,
      now,
      initialStatus === 'claimed' ? now : null,
    ],
  );
  db.save();

  const task = getTask(id)!;

  broadcastToChannel(input.channelId, 'task.created', { task });

  return task;
}

/** Directly assign a task to an agent (assign mode) */
export function assignTask(taskId: string, agentId: string): ClaimResult {
  const task = getTask(taskId);
  if (!task) return { success: false, error: 'NOT_FOUND' };
  if (task.status !== 'pending')
    return { success: false, error: 'ALREADY_CLAIMED', claimedBy: task.assigneeId };

  const db = getDatabase();
  const now = Date.now();

  db.run(
    `UPDATE tasks SET status = 'claimed', assignee_id = ?, claimed_at = ? WHERE id = ? AND status = 'pending'`,
    [agentId, now, taskId],
  );
  db.save();

  const updatedTask = getTask(taskId)!;

  broadcastToChannel(updatedTask.channelId, 'task.claimed', {
    taskId,
    agentId,
    claimedAt: now,
  });

  return { success: true, task: updatedTask };
}

/** Claim a task (compete mode) */
export function claimTask(taskId: string, agentId: string): ClaimResult {
  const db = getDatabase();
  const now = Date.now();

  // Check task exists and get requirements
  const task = getTask(taskId);
  if (!task) return { success: false, error: 'NOT_FOUND' };
  if (task.status !== 'pending')
    return { success: false, error: 'ALREADY_CLAIMED', claimedBy: task.assigneeId };

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
    const hasAll = task.requiredCapabilities.every((cap) => agentCapabilities.includes(cap));
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
      [agentId, now, taskId],
    );

    const result = db.exec('SELECT changes() as changes');
    const changes = result[0]?.values[0][0] as number;

    if (changes === 0) {
      db.run('ROLLBACK');
      const task = getTask(taskId);
      if (!task) return { success: false, error: 'NOT_FOUND' };
      if (task.status !== 'pending')
        return { success: false, error: 'ALREADY_CLAIMED', claimedBy: task.assigneeId };
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
    if (input.status === 'completed' || input.status === 'failed') {
      sets.push('completed_at = ?');
      params.push(Date.now());
    }
    if (input.status === 'claimed') {
      sets.push('claimed_at = ?');
      params.push(Date.now());
    }
    // Clear assignee when releasing back to pending
    if (input.status === 'pending') {
      sets.push('assignee_id = NULL');
    }
  }
  if (input.output !== undefined) {
    sets.push('output = ?');
    params.push(input.output);
  }
  if (input.retry_count !== undefined) {
    sets.push('retry_count = ?');
    params.push(input.retry_count);
  }

  if (sets.length === 0) return getTask(taskId);

  params.push(taskId);
  db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);
  db.save();

  const task = getTask(taskId);
  if (task) {
    // Record reputation for completed or finally-failed group tasks
    const isFinalFailed = input.status === 'failed' && task.retryCount >= task.maxRetries;
    if ((input.status === 'completed' || isFinalFailed) && task.isGroupTask) {
      recordTaskReputation(
        task.id,
        input.status === 'completed' ? 'task_completed' : 'task_failed',
      );
    }

    // Auto-retry: if task failed and retries remain, reset to pending
    if (input.status === 'failed' && task.retryCount < task.maxRetries) {
      const db2 = getDatabase();
      db2.run(
        "UPDATE tasks SET status = 'pending', assignee_id = NULL, retry_count = retry_count + 1, output = NULL WHERE id = ?",
        [taskId],
      );
      db2.save();
      const retriedTask = getTask(taskId)!;
      broadcastToChannel(retriedTask.channelId, 'task.created', { task: retriedTask });
      console.log(
        `[task] Auto-retrying task ${taskId} (attempt ${retriedTask.retryCount}/${retriedTask.maxRetries})`,
      );
      return retriedTask;
    }

    // When releasing back to pending, broadcast as task.created so daemons can claim it
    const broadcastType =
      input.status === 'pending' ? 'task.created' : `task.${input.status || 'updated'}`;
    broadcastToChannel(task.channelId, broadcastType, { task });

    // Cross-team output return: if group task completed, send output to decomposer
    if (input.status === 'completed') {
      const db4 = getDatabase();
      const gtStmt2 = db4.prepare(`
        SELECT gt.group_id, gt.source_team_id, g.contract_yaml
        FROM group_tasks gt
        JOIN groups g ON gt.group_id = g.id
        WHERE gt.task_id = ?
      `);
      gtStmt2.bind([taskId]);
      if (gtStmt2.step()) {
        const gtRow = gtStmt2.getAsObject() as {
          group_id: string;
          source_team_id: string;
          contract_yaml: string;
        };
        gtStmt2.free();

        // Check visibility.task_output setting
        let sendOutput = true;
        try {
          const contract = yaml.load(gtRow.contract_yaml || '') as Record<string, unknown>;
          const visibility = contract.visibility as Record<string, unknown> | undefined;
          if (visibility && visibility.task_output === false) {
            sendOutput = false;
          }
        } catch {
          // Default to sending output
        }

        if (sendOutput) {
          // Find parent task (decomposer)
          if (task.parentTaskId) {
            const parentTask = getTask(task.parentTaskId);
            if (parentTask) {
              // Send review.requested to source team via WebSocket
              broadcastToGroup(gtRow.group_id, 'review.requested', {
                task_id: taskId,
                parent_task_id: task.parentTaskId,
                output: task.output,
                completed_at: task.completedAt,
                source_agent_id: task.assigneeId,
              });
              console.log(
                `[task] Group task ${taskId} output sent to decomposer (parent: ${task.parentTaskId})`,
              );
            }
          }
        }
      } else {
        gtStmt2.free();
      }
    }

    // Cross-team retry: if group task failed, reset to pending for re-claim
    if (input.status === 'failed' && task.retryCount >= task.maxRetries) {
      const db3 = getDatabase();
      const gtStmt = db3.prepare(
        'SELECT group_id, source_team_id FROM group_tasks WHERE task_id = ?',
      );
      gtStmt.bind([taskId]);
      if (gtStmt.step()) {
        const gt = gtStmt.getAsObject() as { group_id: string; source_team_id: string };
        gtStmt.free();

        // Reset task to pending for other agents to claim
        db3.run("UPDATE tasks SET status = 'pending', assignee_id = NULL WHERE id = ?", [taskId]);
        db3.run("UPDATE group_tasks SET authorization_status = 'none' WHERE task_id = ?", [taskId]);
        db3.save();

        // Broadcast to group
        broadcastToGroup(gt.group_id, 'group.task.created', { task: getTask(taskId) });
        console.log(`[task] Group task ${taskId} failed, returned to pool for re-claim`);
      } else {
        gtStmt.free();
      }
    }
  }

  return task;
}

/** Create subtasks for collaborative mode with depth tracking */
export function createSubtasks(
  parentTaskId: string,
  subtasks: Array<{
    channelId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    creatorId: string;
    mode?: 'compete' | 'assign';
  }>,
  maxRetries?: number,
): Task[] {
  const parentTask = getTask(parentTaskId);
  if (!parentTask) return [];

  const childDepth = (parentTask.depth ?? 0) + 1;
  const MAX_DEPTH = 3;
  if (childDepth >= MAX_DEPTH) {
    console.warn(`[task] Cannot create subtasks: depth ${childDepth} >= max ${MAX_DEPTH}`);
    return [];
  }

  const MAX_SUBTASKS = 5;
  const capped = subtasks.slice(0, MAX_SUBTASKS);
  if (subtasks.length > MAX_SUBTASKS) {
    console.warn(`[task] Subtask count ${subtasks.length} > max ${MAX_SUBTASKS}, truncated`);
  }

  const createdTasks: Task[] = [];
  for (const st of capped) {
    const task = createTaskWithParent(
      {
        channelId: st.channelId,
        title: st.title,
        description: st.description,
        mode: st.mode || 'compete',
        assigneeId: st.assigneeId,
        maxRetries: maxRetries ?? 0,
      },
      st.creatorId,
      parentTaskId,
      childDepth,
    );
    createdTasks.push(task);
  }

  // Broadcast subtasks creation
  broadcastToChannel(parentTask.channelId, 'task.subtasks', {
    parentTaskId,
    subtasks: createdTasks,
  });

  return createdTasks;
}

/** Get full task tree (task + all descendants) */
export function getTaskTree(taskId: string): { task: Task; children: Task[] } | null {
  const task = getTask(taskId);
  if (!task) return null;

  const children: Task[] = [];
  const queue = [taskId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const db = getDatabase();
    const stmt = db.prepare(
      'SELECT id FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC',
    );
    stmt.bind([parentId]);

    while (stmt.step()) {
      const row = stmt.getAsObject() as { id: string };
      const child = getTask(row.id);
      if (child) {
        children.push(child);
        queue.push(child.id);
      }
    }
    stmt.free();
  }

  return { task, children };
}

/** Check if all subtasks are completed and trigger verifying */
export function checkParentCompletion(parentTaskId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed FROM tasks WHERE parent_task_id = ?",
  );
  stmt.bind([parentTaskId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as { total: number; completed: number; failed: number };
    stmt.free();

    // All subtasks done (completed or failed)
    if (row.total > 0 && row.completed + row.failed === row.total) {
      const parentTask = getTask(parentTaskId);
      if (!parentTask) return;

      if (row.failed > 0) {
        // Some subtasks failed — check if retries available (use parent's maxRetries)
        const failedTasks = getFailedSubtasks(parentTaskId);
        const parentMaxRetries = parentTask.maxRetries ?? 3;
        let retried = false;
        for (const ft of failedTasks) {
          if (ft.retryCount < parentMaxRetries) {
            // Retry: reset to pending
            db.run(
              "UPDATE tasks SET status = 'pending', assignee_id = NULL, retry_count = retry_count + 1 WHERE id = ?",
              [ft.id],
            );
            retried = true;
          }
        }
        db.save();

        if (retried) {
          broadcastToChannel(parentTask.channelId, 'task.retrying', {
            parentTaskId,
            retriedCount: failedTasks.filter((ft) => ft.retryCount < parentMaxRetries).length,
          });
          // Don't finalize parent yet — wait for retries
          return;
        }
      }

      // All done or no retries left → move to verifying
      updateTask(parentTaskId, { status: 'verifying' });
    }
  } else {
    stmt.free();
  }
}

/** Get failed subtasks for retry */
function getFailedSubtasks(parentTaskId: string): Task[] {
  const db = getDatabase();
  const tasks: Task[] = [];
  const stmt = db.prepare("SELECT id FROM tasks WHERE parent_task_id = ? AND status = 'failed'");
  stmt.bind([parentTaskId]);

  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    const task = getTask(row.id);
    if (task) tasks.push(task);
  }
  stmt.free();
  return tasks;
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

/** Record reputation for a completed or failed group task */
function recordTaskReputation(taskId: string, eventType: 'task_completed' | 'task_failed'): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT gt.group_id, a.team_id
    FROM group_tasks gt
    JOIN tasks t ON gt.task_id = t.id
    LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE gt.task_id = ?
  `);
  stmt.bind([taskId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as { group_id: string; team_id: string | null };
    stmt.free();

    // Domain collaboration tasks carry their owning domain so completion and
    // failure events only count in that domain's reputation; plain group tasks
    // stay domain-less (NULL) and count in every domain.
    let domainId: string | null = null;
    const dtStmt = db.prepare('SELECT domain_id FROM domain_tasks WHERE task_id = ?');
    dtStmt.bind([taskId]);
    if (dtStmt.step()) {
      const dt = dtStmt.getAsObject() as { domain_id: string };
      domainId = dt.domain_id;
    }
    dtStmt.free();

    if (row.team_id) {
      recordReputation(row.team_id, row.group_id, eventType, taskId, domainId ?? undefined);
    }
  } else {
    stmt.free();
  }
}

/** Get tasks assigned to an agent */
export function getTasksByAgent(agentId: string): Task[] {
  const db = getDatabase();
  const tasks: Task[] = [];
  const stmt = db.prepare(
    "SELECT id FROM tasks WHERE assignee_id = ? AND status IN ('claimed', 'running') ORDER BY created_at DESC",
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

  const expiredTasks: Array<{
    id: string;
    channel_id: string;
    retry_count: number;
    max_retries: number;
  }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      channel_id: string;
      retry_count: number;
      max_retries: number;
    };
    expiredTasks.push(row);
  }
  stmt.free();

  for (const task of expiredTasks) {
    if (task.retry_count < task.max_retries) {
      // Retry: reset to pending
      db.run(
        "UPDATE tasks SET status = 'pending', assignee_id = NULL, retry_count = retry_count + 1 WHERE id = ?",
        [task.id],
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
