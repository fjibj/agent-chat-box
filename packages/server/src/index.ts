import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createDatabase, getDatabase } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Project root: packages/server/src → ../../..
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8')).version;
import { handleConnection } from './ws/handler.js';
import { registerMachineRoutes } from './api/machines.js';
import { registerChannelRoutes, ensureDefaultChannel } from './api/channels.js';
import { registerAgentRoutes, registerNameResolution } from './api/agents.js';
import { registerMessageRoutes } from './api/messages.js';
import { registerUploadRoutes } from './api/uploads.js';
import { registerTaskRoutes } from './api/tasks.js';
import { registerTeamRoutes } from './api/teams.js';
import { registerGroupRoutes } from './api/groups.js';
import { registerGroupTaskRoutes } from './api/group-tasks.js';
import { registerAuthorizationRoutes, checkExpiredAuthorizations } from './api/authorizations.js';
import { registerReviewRoutes } from './api/reviews.js';
import { registerReputationRoutes } from './api/reputation.js';
import { startTimeoutChecker, stopTimeoutChecker } from './modules/task-queue.js';
import { handleFederationConnection, registerFederationHubRoutes, startHubHeartbeat } from './federation/hub.js';
import { initFederationRunner } from './federation/runner.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  console.log('[server] Starting...');
  // 1. Initialize database
  const db = await createDatabase();
  console.log('[server] Database ready');

  // 2. Create Fastify instance
  console.log('[server] Creating Fastify...');
  const app = Fastify({ logger: false });
  console.log('[server] Fastify created');

  // 3. CORS
  await app.register(fastifyCors as never, { origin: true, credentials: true });
  console.log('[server] CORS registered');

  // 3.5 Multipart (file uploads)
  await app.register(fastifyMultipart as never);
  console.log('[server] Multipart registered');

  // 4. Static files (Web UI) — only serve if directory exists
  const webDist = path.join(PROJECT_ROOT, 'packages', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    await app.register(fastifyStatic as never, {
      root: webDist,
      prefix: '/',
      wildcard: false,
    });
  }

  // 5. API routes
  app.get('/api/version', async () => ({
    version: VERSION,
    name: 'agent-chat-box',
  }));

  app.get('/api/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
  }));

  app.get('/api/server-info', async () => ({
    version: VERSION,
    name: 'agent-chat-box',
    host: HOST,
    port: PORT,
    wsUrl: `ws://${HOST}:${PORT}/ws`,
    daemonUrl: `ws://${HOST}:${PORT}/daemon/connect`,
    dbPath: path.join(PROJECT_ROOT, 'data', 'agent-chat-box.sqlite'),
    uptime: process.uptime(),
  }));

  // Serve daemon bundle for remote machines
  app.get('/daemon.js', async (_request, reply) => {
    const daemonPath = path.join(PROJECT_ROOT, 'packages', 'daemon', 'dist', 'daemon.cjs');
    if (!fs.existsSync(daemonPath)) {
      return reply.status(404).send({ error: 'Daemon bundle not built. Run: cd packages/daemon && npx esbuild src/index.ts --bundle --platform=node --format=cjs --outfile=dist/daemon.cjs' });
    }
    const content = fs.readFileSync(daemonPath, 'utf-8');
    return reply.header('Content-Type', 'application/javascript').send(content);
  });

  // Machine management routes
  await registerMachineRoutes(app);
  console.log('[server] Machine routes registered');

  // Channel routes
  await registerChannelRoutes(app);
  console.log('[server] Channel routes registered');

  // Agent routes
  await registerAgentRoutes(app);
  registerNameResolution(app);
  console.log('[server] Agent routes registered');

  // Message routes
  await registerMessageRoutes(app);
  console.log('[server] Message routes registered');

  // Upload routes
  await registerUploadRoutes(app);
  console.log('[server] Upload routes registered');

  // Task routes
  try {
    await registerTaskRoutes(app);
    console.log('[server] Task routes registered');
  } catch (err) {
    console.error('[server] Failed to register task routes:', err);
  }

  // Team routes
  try {
    await registerTeamRoutes(app);
    console.log('[server] Team routes registered');
  } catch (err) {
    console.error('[server] Failed to register team routes:', err);
  }

  // Group routes
  try {
    await registerGroupRoutes(app);
    console.log('[server] Group routes registered');
  } catch (err) {
    console.error('[server] Failed to register group routes:', err);
  }

  // Group task routes
  try {
    await registerGroupTaskRoutes(app);
    console.log('[server] Group task routes registered');
  } catch (err) {
    console.error('[server] Failed to register group task routes:', err);
  }

  // Authorization routes
  try {
    await registerAuthorizationRoutes(app);
    console.log('[server] Authorization routes registered');
  } catch (err) {
    console.error('[server] Failed to register authorization routes:', err);
  }

  // Review routes
  try {
    await registerReviewRoutes(app);
    console.log('[server] Review routes registered');
  } catch (err) {
    console.error('[server] Failed to register review routes:', err);
  }

  // Reputation routes
  try {
    await registerReputationRoutes(app);
    console.log('[server] Reputation routes registered');
  } catch (err) {
    console.error('[server] Failed to register reputation routes:', err);
  }

  // Federation Hub routes
  try {
    await registerFederationHubRoutes(app);
    console.log('[server] Federation Hub routes registered');
  } catch (err) {
    console.error('[server] Failed to register federation hub routes:', err);
  }

  // Ensure default channel exists
  ensureDefaultChannel();

  // Clean up stale members on startup
  {
    const cleanupDb = getDatabase();
    // Remove human members (they rejoin on connect)
    cleanupDb.run('DELETE FROM channel_members WHERE member_kind = ?', ['human']);
    // Remove agent members whose agent no longer exists
    cleanupDb.run(`DELETE FROM channel_members WHERE member_kind = 'agent' AND member_id NOT IN (SELECT id FROM agents)`);
    cleanupDb.save();
  }
  console.log('[server] Cleaned up stale channel members');

  // Start task timeout checker
  startTimeoutChecker();

  // Start authorization timeout checker (every 30 seconds)
  const authCheckInterval = setInterval(checkExpiredAuthorizations, 30_000);

  // Start federation hub heartbeat checker
  startHubHeartbeat();

  // SPA fallback for client-side routing (React Router)
  app.setNotFoundHandler(async (request, reply) => {
    const url = request.url || '/';
    if (url.startsWith('/api') || url.startsWith('/ws') || url.startsWith('/daemon') || url === '/daemon.js') {
      return reply.status(404).send({ error: 'Not Found' });
    }
    const indexHtml = path.join(webDist, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return reply.type('text/html').send(fs.readFileSync(indexHtml));
    }
    return reply.status(404).send({ error: 'Not Found' });
  });

  // 6. Error handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const err = error as Error & { statusCode?: number };
    reply.status(err.statusCode || 500).send({
      error: err.message || 'Internal Server Error',
    });
  });

  // 7. Start HTTP server
  await app.listen({ port: PORT, host: HOST });
  console.log(`[server] HTTP listening on http://${HOST}:${PORT}`);

  // 8. WebSocket servers — attach to underlying HTTP server
  const httpServer = app.server;

  const wssHuman = new WebSocketServer({ noServer: true });
  const wssDaemon = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);

    if (url.pathname === '/ws') {
      wssHuman.handleUpgrade(request, socket, head, (ws) => {
        handleConnection(ws, 'human');
      });
    } else if (url.pathname === '/daemon/connect') {
      wssDaemon.handleUpgrade(request, socket, head, (ws) => {
        handleConnection(ws, 'daemon');
      });
    } else if (url.pathname === '/federation') {
      wssDaemon.handleUpgrade(request, socket, head, (ws) => {
        handleFederationConnection(ws);
      });
    } else {
      socket.destroy();
    }
  });

  console.log('[server] WebSocket endpoints: /ws, /daemon/connect, /federation');

  // Initialize federation runner if configured
  if (process.env.FEDERATION_URL && process.env.FEDERATION_INVITE_CODE) {
    initFederationRunner({
      hubUrl: process.env.FEDERATION_URL,
      inviteCode: process.env.FEDERATION_INVITE_CODE,
      teamId: process.env.FEDERATION_TEAM_ID || 'unknown',
    });
  }

  // 9. Graceful shutdown
  const shutdown = async () => {
    console.log('[server] Shutting down...');
    stopTimeoutChecker();
    clearInterval(authCheckInterval);
    import('./federation/hub.js').then(({ stopHubHeartbeat }) => stopHubHeartbeat());
    wssHuman.close();
    wssDaemon.close();
    db.save();
    db.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[server] Fatal:', err);
  process.exit(1);
});
