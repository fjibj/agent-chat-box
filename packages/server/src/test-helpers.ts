import Fastify from 'fastify';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseWrapper, setDatabase, resetDatabase } from './db/index.js';
import { registerMachineRoutes } from './api/machines.js';
import fastifyMultipart from '@fastify/multipart';
import { registerChannelRoutes, ensureDefaultChannel } from './api/channels.js';
import { registerAgentRoutes, registerNameResolution } from './api/agents.js';
import { registerMessageRoutes } from './api/messages.js';
import { registerUploadRoutes } from './api/uploads.js';
import { registerTaskRoutes } from './api/tasks.js';
import { registerTeamRoutes } from './api/teams.js';
import { registerGroupRoutes } from './api/groups.js';
import { registerGroupTaskRoutes } from './api/group-tasks.js';
import { registerAuthorizationRoutes } from './api/authorizations.js';
import { registerReviewRoutes } from './api/reviews.js';
import { registerReputationRoutes } from './api/reputation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Create an in-memory test database with the latest schema. */
export async function createTestDb(): Promise<DatabaseWrapper> {
  const wasmPath = path.resolve(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });
  const rawDb = new SQL.Database();
  const db = new DatabaseWrapper(rawDb);

  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  db.run('PRAGMA user_version = 8');

  return db;
}

/** Build a Fastify app with all routes registered and an in-memory DB. */
export async function buildApp() {
  resetDatabase();
  const db = await createTestDb();
  setDatabase(db);

  const app = Fastify({ logger: false });

  // Register multipart plugin for uploads
  await app.register(fastifyMultipart as never);

  // Routes only — skip static files and WebSocket
  await registerMachineRoutes(app);
  await registerChannelRoutes(app);
  await registerAgentRoutes(app);
  registerNameResolution(app);
  await registerMessageRoutes(app);
  await registerUploadRoutes(app);
  await registerTaskRoutes(app);
  await registerTeamRoutes(app);
  await registerGroupRoutes(app);
  await registerGroupTaskRoutes(app);
  await registerAuthorizationRoutes(app);
  await registerReviewRoutes(app);
  await registerReputationRoutes(app);

  ensureDefaultChannel();

  return { app, db };
}

/** Helper to create a team via API. */
export async function createTeam(app: Awaited<ReturnType<typeof buildApp>>['app'], name: string, userId: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/teams',
    payload: { name, user_id: userId },
  });
  return JSON.parse(res.payload) as { id: string; name: string; owner_user_id: string };
}

/** Helper to create a machine via API. */
export async function createMachine(app: Awaited<ReturnType<typeof buildApp>>['app'], name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/machines',
    payload: { name },
  });
  return JSON.parse(res.payload) as { id: string; name: string; apiKey: string };
}

/** Helper to create an agent via API. */
export async function createAgent(
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  machineId: string,
  name: string,
  runtime: string,
  capabilities?: string[],
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/agents',
    payload: { machineId, name, runtime, capabilities },
  });
  return JSON.parse(res.payload) as { id: string; name: string; runtime: string };
}

/** Helper to create a group via API. */
export async function createGroup(
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  name: string,
  ownerTeamId: string,
  description?: string,
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/groups',
    payload: { name, owner_team_id: ownerTeamId, description },
  });
  return JSON.parse(res.payload) as { id: string; name: string; owner_team_id: string; channel_id?: string };
}

/** Helper to add a team member. */
export async function addTeamMember(app: Awaited<ReturnType<typeof buildApp>>['app'], teamId: string, userId: string, role = 'member') {
  const res = await app.inject({
    method: 'POST',
    url: `/api/teams/${teamId}/members`,
    payload: { user_id: userId, role },
  });
  return JSON.parse(res.payload);
}
