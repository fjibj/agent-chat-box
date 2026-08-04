import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { getDatabase } from '../db/index.js';
import type { Agent, RoleCard } from '@agent-chat-box/shared';

/** Register agent API routes */
export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/agents — create agent
  app.post('/api/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      machineId?: string;
      name?: string;
      runtime?: string;
      description?: string;
      capabilities?: string[];
      labels?: string[];
    };

    if (!body.machineId || !body.name || !body.runtime) {
      return reply.status(400).send({ error: 'machineId, name, and runtime are required' });
    }

    const validRuntimes = ['claude', 'codex', 'openclaw', 'hermes'];
    if (!validRuntimes.includes(body.runtime)) {
      return reply
        .status(400)
        .send({ error: `runtime must be one of: ${validRuntimes.join(', ')}` });
    }

    const db = getDatabase();

    // Verify machine exists and fetch its team_id
    const machineStmt = db.prepare('SELECT id, team_id FROM machines WHERE id = ?');
    machineStmt.bind([body.machineId]);
    if (!machineStmt.step()) {
      machineStmt.free();
      return reply.status(404).send({ error: 'Machine not found' });
    }
    const machineRow = machineStmt.getAsObject() as { team_id: string | null };
    const machineTeamId = machineRow.team_id;
    machineStmt.free();

    const id = crypto.randomUUID();
    const name = body.name.trim();
    const description = body.description?.trim() || '';
    const capabilities = body.capabilities || [];
    const labels = body.labels || [];
    const roleCard: RoleCard = { name, description };

    db.run(
      `INSERT INTO agents (id, machine_id, name, runtime, capabilities, role_card, labels, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.machineId,
        name,
        body.runtime,
        JSON.stringify(capabilities),
        JSON.stringify(roleCard),
        JSON.stringify(labels),
        'sleeping',
      ],
    );
    db.save();

    return reply.status(201).send({
      id,
      machineId: body.machineId,
      teamId: machineTeamId,
      name,
      runtime: body.runtime,
      status: 'sleeping',
      roleCard,
      capabilities,
      labels,
      currentTaskId: null,
    });
  });

  // GET /api/agents — list agents
  app.get('/api/agents', async (request: FastifyRequest) => {
    const query = request.query as { machineId?: string };
    const db = getDatabase();

    let sql =
      'SELECT id, machine_id, team_id, name, runtime, status, capabilities, role_card, labels, current_task_id, last_sleep_at, last_wake_at, created_at FROM agents';
    const params: unknown[] = [];

    if (query.machineId) {
      sql += ' WHERE machine_id = ?';
      params.push(query.machineId);
    }
    sql += ' ORDER BY created_at DESC';

    const agents: Agent[] = [];
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);

    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      agents.push({
        id: row.id as string,
        machineId: row.machine_id as string,
        teamId: row.team_id as string | null,
        name: row.name as string,
        runtime: row.runtime as Agent['runtime'],
        status: row.status as Agent['status'],
        roleCard: JSON.parse(row.role_card as string),
        capabilities: JSON.parse((row.capabilities as string) || '[]'),
        labels: JSON.parse((row.labels as string) || '[]'),
        currentTaskId: row.current_task_id as string | undefined,
        lastSleepAt: row.last_sleep_at as number | undefined,
        lastWakeAt: row.last_wake_at as number | undefined,
      });
    }
    stmt.free();

    return { agents };
  });

  // GET /api/agents/:id — get single agent
  app.get('/api/agents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    const stmt = db.prepare(
      'SELECT id, machine_id, team_id, name, runtime, status, capabilities, role_card, labels, current_task_id, last_sleep_at, last_wake_at, created_at FROM agents WHERE id = ?',
    );
    stmt.bind([id]);

    if (!stmt.step()) {
      stmt.free();
      return reply.status(404).send({ error: 'Agent not found' });
    }

    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();

    return {
      id: row.id,
      machineId: row.machine_id,
      teamId: row.team_id,
      name: row.name,
      runtime: row.runtime,
      status: row.status,
      roleCard: JSON.parse(row.role_card as string),
      capabilities: JSON.parse((row.capabilities as string) || '[]'),
      labels: JSON.parse((row.labels as string) || '[]'),
      currentTaskId: row.current_task_id,
      lastSleepAt: row.last_sleep_at,
      lastWakeAt: row.last_wake_at,
      createdAt: row.created_at,
    };
  });

  // PATCH /api/agents/:id — update agent
  app.patch('/api/agents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      capabilities?: string[];
      labels?: string[];
      team_id?: string;
    };

    const db = getDatabase();

    // Check existence
    const checkStmt = db.prepare('SELECT id, role_card FROM agents WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Agent not found' });
    }
    const existing = checkStmt.getAsObject() as { role_card: string };
    checkStmt.free();

    // Build update
    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name) {
      updates.push('name = ?');
      params.push(body.name.trim());
    }
    if (body.description !== undefined) {
      const roleCard = JSON.parse(existing.role_card);
      roleCard.description = body.description.trim();
      updates.push('role_card = ?');
      params.push(JSON.stringify(roleCard));
    }
    if (body.capabilities) {
      updates.push('capabilities = ?');
      params.push(JSON.stringify(body.capabilities));
    }
    if (body.labels) {
      updates.push('labels = ?');
      params.push(JSON.stringify(body.labels));
    }
    if (body.team_id !== undefined) {
      // Verify the team exists before assigning the agent to it
      const teamStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
      teamStmt.bind([body.team_id]);
      const teamFound = teamStmt.step();
      teamStmt.free();
      if (!teamFound) {
        return reply.status(404).send({ error: 'Team not found' });
      }
      updates.push('team_id = ?');
      params.push(body.team_id);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    params.push(id);
    db.run(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, params);
    db.save();

    return { success: true };
  });

  // DELETE /api/agents/:id — delete agent
  app.delete('/api/agents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    const checkStmt = db.prepare('SELECT id FROM agents WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Agent not found' });
    }
    checkStmt.free();

    db.run('DELETE FROM agents WHERE id = ?', [id]);
    db.run('DELETE FROM channel_members WHERE member_id = ? AND member_kind = ?', [id, 'agent']);
    db.save();

    return { success: true };
  });
}

/** Register an agent via WebSocket (agent.hello) */
export function registerAgentWs(
  machineId: string,
  agentData: {
    agentId?: string;
    name: string;
    runtime: string;
    roleCard: RoleCard;
    capabilities: string[];
    labels?: string[];
  },
): Agent | null {
  const db = getDatabase();

  // Get machine's team_id for auto-assignment
  const machineStmt = db.prepare('SELECT team_id FROM machines WHERE id = ?');
  machineStmt.bind([machineId]);
  let machineTeamId: string | null = null;
  if (machineStmt.step()) {
    const machineRow = machineStmt.getAsObject() as { team_id: string | null };
    machineTeamId = machineRow.team_id;
  }
  machineStmt.free();

  // Check if agent already exists for this machine (by name or same runtime)
  const existingStmt = db.prepare(
    'SELECT id, labels FROM agents WHERE machine_id = ? AND (name = ? OR runtime = ?)',
  );
  existingStmt.bind([machineId, agentData.name, agentData.runtime]);
  if (existingStmt.step()) {
    const row = existingStmt.getAsObject() as { id: string; labels: string };
    existingStmt.free();
    // Preserve manually-assigned labels and team_id when daemon re-registers.
    const existingLabels = JSON.parse(row.labels || '[]') as string[];
    const incomingLabels = agentData.labels || [];
    const mergedLabels = incomingLabels.length > 0 ? incomingLabels : existingLabels;
    // Update existing agent (leave team_id untouched)
    db.run(
      'UPDATE agents SET name = ?, runtime = ?, role_card = ?, capabilities = ?, labels = ?, status = ?, last_wake_at = ? WHERE id = ?',
      [
        agentData.name,
        agentData.runtime,
        JSON.stringify(agentData.roleCard),
        JSON.stringify(agentData.capabilities),
        JSON.stringify(mergedLabels),
        'awake',
        Date.now(),
        row.id,
      ],
    );
    db.save();
    return getAgentById(row.id);
  }
  existingStmt.free();

  // Create new agent
  const id = agentData.agentId || crypto.randomUUID();
  db.run(
    `INSERT INTO agents (id, machine_id, team_id, name, runtime, capabilities, role_card, labels, status, last_wake_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      machineId,
      machineTeamId, // Auto-assign to machine's team
      agentData.name,
      agentData.runtime,
      JSON.stringify(agentData.capabilities),
      JSON.stringify(agentData.roleCard),
      JSON.stringify(agentData.labels || []),
      'awake',
      Date.now(),
    ],
  );
  db.save();

  // Auto-join default channel
  const channelStmt = db.prepare(
    "SELECT id FROM channels WHERE name = 'general' AND type = 'group'",
  );
  if (channelStmt.step()) {
    const channel = channelStmt.getAsObject() as { id: string };
    db.run(
      'INSERT OR IGNORE INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)',
      [channel.id, id, 'agent'],
    );
    db.save();
  }
  channelStmt.free();

  return getAgentById(id);
}

/** Get agent by ID */
export function getAgentById(id: string): Agent | null {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT id, machine_id, team_id, name, runtime, status, capabilities, role_card, labels, current_task_id, last_sleep_at, last_wake_at FROM agents WHERE id = ?',
  );
  stmt.bind([id]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();

  return {
    id: row.id as string,
    machineId: row.machine_id as string,
    teamId: row.team_id as string | null,
    name: row.name as string,
    runtime: row.runtime as Agent['runtime'],
    status: row.status as Agent['status'],
    roleCard: JSON.parse(row.role_card as string),
    capabilities: JSON.parse((row.capabilities as string) || '[]'),
    labels: JSON.parse((row.labels as string) || '[]'),
    currentTaskId: row.current_task_id as string | undefined,
    lastSleepAt: row.last_sleep_at as number | undefined,
    lastWakeAt: row.last_wake_at as number | undefined,
  };
}

/** Register name resolution endpoint */
export function registerNameResolution(app: FastifyInstance): void {
  // GET /api/resolve-names?ids=id1,id2,id3 — resolve UUIDs to display names
  app.get('/api/resolve-names', async (request: FastifyRequest) => {
    const { ids } = request.query as { ids?: string };
    if (!ids) return { names: {} };

    const idList = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const names: Record<string, string> = {};

    // 1. Look up agents from DB
    const db = getDatabase();
    for (const id of idList) {
      const stmt = db.prepare('SELECT name FROM agents WHERE id = ?');
      stmt.bind([id]);
      if (stmt.step()) {
        const row = stmt.getAsObject() as { name: string };
        names[id] = row.name;
      }
      stmt.free();
    }

    // 2. Look up connected human clients
    const { getClients } = await import('../ws/handler.js');
    for (const [clientId, client] of getClients()) {
      if (client.type === 'human' && client.name && idList.includes(clientId)) {
        names[clientId] = client.name;
      }
      // Also check client-provided stable ID
      if (client.type === 'human' && client.name && idList.includes(client.id)) {
        names[client.id] = client.name;
      }
    }

    // 3. Look up teams from DB
    for (const id of idList) {
      if (names[id]) continue;
      const stmt = db.prepare('SELECT name FROM teams WHERE id = ?');
      stmt.bind([id]);
      if (stmt.step()) {
        const row = stmt.getAsObject() as { name: string };
        names[id] = row.name;
      }
      stmt.free();
    }

    // 4. Look up groups from DB
    for (const id of idList) {
      if (names[id]) continue;
      const stmt = db.prepare('SELECT name FROM groups WHERE id = ?');
      stmt.bind([id]);
      if (stmt.step()) {
        const row = stmt.getAsObject() as { name: string };
        names[id] = row.name;
      }
      stmt.free();
    }

    // 5. Fill in unknowns with truncated UUID
    for (const id of idList) {
      if (!names[id]) {
        names[id] = id.slice(0, 8) + '...';
      }
    }

    return { names };
  });
}

/** Get agents by machine ID */
export function getAgentsByMachineId(machineId: string): Agent[] {
  const db = getDatabase();
  const agents: Agent[] = [];
  const stmt = db.prepare(
    'SELECT id, machine_id, team_id, name, runtime, status, capabilities, role_card, labels, current_task_id, last_sleep_at, last_wake_at FROM agents WHERE machine_id = ?',
  );
  stmt.bind([machineId]);

  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    agents.push({
      id: row.id as string,
      machineId: row.machine_id as string,
      teamId: row.team_id as string | null,
      name: row.name as string,
      runtime: row.runtime as Agent['runtime'],
      status: row.status as Agent['status'],
      roleCard: JSON.parse(row.role_card as string),
      capabilities: JSON.parse((row.capabilities as string) || '[]'),
      labels: JSON.parse((row.labels as string) || '[]'),
      currentTaskId: row.current_task_id as string | undefined,
      lastSleepAt: row.last_sleep_at as number | undefined,
      lastWakeAt: row.last_wake_at as number | undefined,
    });
  }
  stmt.free();

  return agents;
}
