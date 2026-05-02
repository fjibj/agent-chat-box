import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { createDatabase } from '../packages/server/src/db/index.js';
import { registerMachineRoutes } from '../packages/server/src/api/machines.js';
import { registerChannelRoutes, ensureDefaultChannel } from '../packages/server/src/api/channels.js';
import { registerAgentRoutes } from '../packages/server/src/api/agents.js';
import { registerMessageRoutes } from '../packages/server/src/api/messages.js';
import { registerTaskRoutes } from '../packages/server/src/api/tasks.js';
import { registerUploadRoutes } from '../packages/server/src/api/uploads.js';

/**
 * Create a Fastify app with all routes and an initialized in-memory DB.
 */
export async function createTestApp() {
  await createDatabase();

  const app = Fastify({ logger: false });
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyMultipart);

  app.get('/api/version', async () => ({ version: '0.1.0-test', name: 'agent-chat-box' }));
  app.get('/api/health', async () => ({ status: 'ok' }));

  await registerMachineRoutes(app);
  await registerChannelRoutes(app);
  await registerAgentRoutes(app);
  await registerMessageRoutes(app);
  await registerUploadRoutes(app);
  await registerTaskRoutes(app);

  ensureDefaultChannel();

  return app;
}

/** Helper: create machine via API */
export async function createTestMachine(app: any, name = 'test-machine') {
  const res = await app.inject({ method: 'POST', url: '/api/machines', payload: { name } });
  return res.json();
}

/** Helper: create agent via API */
export async function createTestAgent(app: any, machineId: string, name = 'test-agent', runtime = 'claude') {
  const res = await app.inject({ method: 'POST', url: '/api/agents', payload: { machineId, name, runtime } });
  return res.json();
}

/** Helper: get default channel id */
export async function getDefaultChannelId(app: any): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/channels' });
  const { channels } = res.json();
  return channels.find((c: any) => c.name === 'general')?.id;
}
