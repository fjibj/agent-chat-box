import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  getClients,
  getGroupTeams,
  getTeamClients,
  sendTo,
  broadcastToGroup,
  updateTeamClientsMapping,
  refreshGroupTeamsMap,
  handleConnection,
  broadcastToChannel,
  broadcast,
  getClient,
  sendError,
} from './handler.js';
import { getChannelMembers } from '../api/channels.js';
import { buildApp } from '../test-helpers.js';

// Mock WebSocket with event emitter capabilities
class MockWebSocket {
  readyState: number = WebSocket.OPEN;
  sent: string[] = [];
  close = vi.fn(() => {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  });
  send = vi.fn((data: string) => this.sent.push(data));
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  });
  ping = vi.fn();
  private _handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  emit(event: string, ...args: unknown[]) {
    this._handlers[event]?.forEach((h) => h(...args));
  }
}

vi.mock('../api/channels.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../api/channels.js')>();
  return {
    ...mod,
    getChannelMembers: vi.fn(() => []),
  };
});

vi.mock('../api/agents.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../api/agents.js')>();
  return {
    ...mod,
    registerAgentWs: vi.fn(() => ({ id: 'agent-1', name: 'A1', teamId: 'team-1' })),
    getAgentById: vi.fn(() => ({ id: 'agent-1', name: 'A1' })),
  };
});

vi.mock('../api/machines.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../api/machines.js')>();
  return {
    ...mod,
    findMachineByApiKey: vi.fn((key: string) => {
      if (key === 'invalid-key' || key === 'wrong-token') return null;
      return { id: 'machine-1', name: 'M1' };
    }),
  };
});

describe('WebSocket Handler Unit Tests', () => {
  beforeEach(() => {
    // Clear all internal maps
    getClients().clear();
    getGroupTeams().clear();
    getTeamClients().clear();
  });

  describe('sendTo', () => {
    it('sends message to an existing client', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const clients = getClients();
      clients.set('client-1', { ws, type: 'human' as const, id: 'client-1', authenticated: true });

      sendTo('client-1', { v: 1, type: 'test.msg', ts: Date.now(), data: {} });

      expect(ws.send).toHaveBeenCalled();
    });

    it('does nothing for non-existent client', () => {
      // Should not throw
      expect(() =>
        sendTo('non-existent', { v: 1, type: 'test.msg', ts: Date.now(), data: {} }),
      ).not.toThrow();
    });

    it('does nothing when client socket is not OPEN', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      (ws as unknown as MockWebSocket).readyState = WebSocket.CLOSED;
      const clients = getClients();
      clients.set('client-1', { ws, type: 'human' as const, id: 'client-1', authenticated: true });

      sendTo('client-1', { v: 1, type: 'test.msg', ts: Date.now(), data: {} });

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToGroup', () => {
    it('broadcasts to all clients of teams in group', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;
      const ws3 = new MockWebSocket() as unknown as WebSocket;

      const clients = getClients();
      clients.set('c1', { ws: ws1, type: 'daemon' as const, id: 'c1', authenticated: true, machineId: 'm1' });
      clients.set('c2', { ws: ws2, type: 'daemon' as const, id: 'c2', authenticated: true, machineId: 'm2' });
      clients.set('c3', { ws: ws3, type: 'human' as const, id: 'c3', authenticated: true });

      const groupTeams = getGroupTeams();
      groupTeams.set('group-1', new Set(['team-a', 'team-b']));

      const teamClients = getTeamClients();
      teamClients.set('team-a', new Set(['c1', 'c3']));
      teamClients.set('team-b', new Set(['c2']));

      broadcastToGroup('group-1', 'group.msg', { foo: 'bar' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
      expect(ws3.send).toHaveBeenCalled();

      // Verify payload structure
      const payload = JSON.parse((ws1.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(payload.type).toBe('group.msg');
      expect(payload.data.foo).toBe('bar');
    });

    it('skips excluded client', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      const clients = getClients();
      clients.set('c1', { ws: ws1, type: 'daemon' as const, id: 'c1', authenticated: true, machineId: 'm1' });
      clients.set('c2', { ws: ws2, type: 'daemon' as const, id: 'c2', authenticated: true, machineId: 'm2' });

      const groupTeams = getGroupTeams();
      groupTeams.set('group-1', new Set(['team-a']));

      const teamClients = getTeamClients();
      teamClients.set('team-a', new Set(['c1', 'c2']));

      broadcastToGroup('group-1', 'group.msg', {}, 'c1');

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('skips clients with non-OPEN socket', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      (ws1 as unknown as MockWebSocket).readyState = WebSocket.CLOSED;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      const clients = getClients();
      clients.set('c1', { ws: ws1, type: 'daemon' as const, id: 'c1', authenticated: true, machineId: 'm1' });
      clients.set('c2', { ws: ws2, type: 'daemon' as const, id: 'c2', authenticated: true, machineId: 'm2' });

      const groupTeams = getGroupTeams();
      groupTeams.set('group-1', new Set(['team-a']));

      const teamClients = getTeamClients();
      teamClients.set('team-a', new Set(['c1', 'c2']));

      broadcastToGroup('group-1', 'group.msg', {});

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('does nothing for unknown group', () => {
      // Should not throw
      expect(() => broadcastToGroup('unknown-group', 'group.msg', {})).not.toThrow();
    });

    it('does nothing for team with no mapped clients', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const clients = getClients();
      clients.set('c1', { ws: ws1, type: 'daemon' as const, id: 'c1', authenticated: true, machineId: 'm1' });

      const groupTeams = getGroupTeams();
      groupTeams.set('group-1', new Set(['team-a', 'team-b']));

      // Only team-a has clients; team-b has none
      const teamClients = getTeamClients();
      teamClients.set('team-a', new Set(['c1']));

      broadcastToGroup('group-1', 'group.msg', {});

      expect(ws1.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateTeamClientsMapping', () => {
    it('adds client to team mapping', () => {
      updateTeamClientsMapping('client-1', 'team-a');
      expect(getTeamClients().get('team-a')?.has('client-1')).toBe(true);
    });

    it('removes client from old team when switching', () => {
      updateTeamClientsMapping('client-1', 'team-a');
      updateTeamClientsMapping('client-1', 'team-b');

      expect(getTeamClients().get('team-a')?.has('client-1') ?? false).toBe(false);
      expect(getTeamClients().get('team-b')?.has('client-1')).toBe(true);
    });

    it('removes client entirely when teamId is null', () => {
      updateTeamClientsMapping('client-1', 'team-a');
      updateTeamClientsMapping('client-1', null);

      for (const cids of getTeamClients().values()) {
        expect(cids.has('client-1')).toBe(false);
      }
    });

    it('cleans up empty team entries', () => {
      updateTeamClientsMapping('client-1', 'team-a');
      updateTeamClientsMapping('client-1', null);

      expect(getTeamClients().has('team-a')).toBe(false);
    });
  });

  describe('refreshGroupTeamsMap', () => {
    it('rebuilds groupTeams from database', async () => {
      const { db } = await buildApp();
      db.run('INSERT INTO groups (id, name, owner_team_id, created_at) VALUES (?, ?, ?, ?)', [
        'group-1',
        'G1',
        'team-a',
        0,
      ]);
      db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
        'group-1',
        'team-b',
        'member',
        0,
      ]);
      db.save();

      refreshGroupTeamsMap();

      const gt = getGroupTeams();
      expect(gt.has('group-1')).toBe(true);
      expect(gt.get('group-1')?.has('team-b')).toBe(true);
    });
  });

  describe('broadcastToChannel', () => {
    it('sends to channel members only', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      const clients = getClients();
      clients.set('c1', { ws: ws1, type: 'human' as const, id: 'c1', authenticated: true });
      clients.set('c2', { ws: ws2, type: 'human' as const, id: 'c2', authenticated: true });

      (getChannelMembers as ReturnType<typeof vi.fn>).mockReturnValue([{ memberId: 'c1', kind: 'human' }]);

      broadcastToChannel('ch-1', 'msg.new', { text: 'hi' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('creates a human client and sends welcome', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'human');

      expect(client.type).toBe('human');
      expect(client.authenticated).toBe(true);
      expect(ws.send).toHaveBeenCalled();

      const welcomePayload = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(welcomePayload.type).toBe('system.welcome');
    });

    it('creates a daemon client requiring auth', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'daemon');

      expect(client.type).toBe('daemon');
      expect(client.authenticated).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('sends to all authenticated clients', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;
      const ws3 = new MockWebSocket() as unknown as WebSocket;
      (ws3 as unknown as MockWebSocket).readyState = WebSocket.CLOSED;

      getClients().set('c1', { ws: ws1, type: 'human' as const, id: 'c1', authenticated: true });
      getClients().set('c2', { ws: ws2, type: 'human' as const, id: 'c2', authenticated: true });
      getClients().set('c3', { ws: ws3, type: 'human' as const, id: 'c3', authenticated: true });

      broadcast({ v: 1, type: 'test.broadcast', ts: Date.now(), data: {} });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
      expect(ws3.send).not.toHaveBeenCalled();
    });
  });

  describe('getClient', () => {
    it('returns client by id', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      getClients().set('c1', { ws, type: 'human' as const, id: 'c1', authenticated: true });

      expect(getClient('c1')?.id).toBe('c1');
      expect(getClient('non-existent')).toBeUndefined();
    });
  });

  describe('sendError', () => {
    it('sends error message to client', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = { ws, type: 'human' as const, id: 'c1', authenticated: true };

      sendError(client, 'msg-1', 'TEST_ERROR', 'Test error message');

      expect(ws.send).toHaveBeenCalled();
      const payload = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(payload.type).toBe('error');
      expect(payload.data.code).toBe('TEST_ERROR');
    });
  });

  describe('message routing', () => {
    it('handles ping message', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'ping-1', type: 'ping', ts: Date.now(), data: {},
      })));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const pongCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'pong';
        } catch {
          return false;
        }
      });
      expect(pongCall).toBeDefined();
    });

    it('rejects invalid JSON', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from('not json'));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const errorCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'error' && p.data.code === 'PARSE_ERROR';
        } catch {
          return false;
        }
      });
      expect(errorCall).toBeDefined();
    });

    it('rejects invalid envelope', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 2, type: 'ping', ts: Date.now(), data: {},
      } as unknown)));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const errorCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'error' && p.data.code === 'INVALID_MESSAGE';
        } catch {
          return false;
        }
      });
      expect(errorCall).toBeDefined();
    });

    it('rejects unauthenticated daemon messages', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      handleConnection(ws, 'daemon');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'msg-1', type: 'ping', ts: Date.now(), data: {},
      })));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const errorCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'error' && p.data.code === 'AUTH_REQUIRED';
        } catch {
          return false;
        }
      });
      expect(errorCall).toBeDefined();
    });

    it('handles unhandled message type', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'msg-1', type: 'unknown.type', ts: Date.now(), data: {},
      })));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const errorCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'error' && p.data.code === 'UNHANDLED';
        } catch {
          return false;
        }
      });
      expect(errorCall).toBeDefined();
    });
  });

  describe('human.identify', () => {
    it('sets client name', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'msg-1', type: 'human.identify', ts: Date.now(),
        data: { name: 'Alice' },
      })));

      expect(client.name).toBe('Alice');
    });

    it('rejects empty name', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'msg-1', type: 'human.identify', ts: Date.now(),
        data: { name: '   ' },
      })));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const errorCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'error' && p.data.code === 'INVALID_PAYLOAD';
        } catch {
          return false;
        }
      });
      expect(errorCall).toBeDefined();
    });
  });

  describe('machine.auth', () => {
    it('authenticates daemon with valid API key', async () => {
      const { app, db } = await buildApp();
      // Create a machine with API key
      const createRes = await app.inject({ method: 'POST', url: '/api/machines', payload: { name: 'auth-machine' } });
      const { apiKey } = JSON.parse(createRes.payload);

      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'daemon');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'auth-1', type: 'machine.auth', ts: Date.now(),
        data: { machine_token: apiKey },
      })));

      expect(client.authenticated).toBe(true);
      expect(client.machineId).toBeDefined();
    });

    it('rejects invalid API key', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'daemon');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'auth-1', type: 'machine.auth', ts: Date.now(),
        data: { machine_token: 'invalid-key' },
      })));

      expect(client.authenticated).toBe(false);
      expect(ws.close).toHaveBeenCalled();
    });

    it('rejects human client trying to auth as machine', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'auth-1', type: 'machine.auth', ts: Date.now(),
        data: { machine_token: 'any-key' },
      })));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const errorCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'error' && p.data.code === 'AUTH_INVALID';
        } catch {
          return false;
        }
      });
      expect(errorCall).toBeDefined();
    });
  });

  describe('channel.join', () => {
    it('joins a channel', async () => {
      const { app, db } = await buildApp();
      const createRes = await app.inject({ method: 'POST', url: '/api/channels', payload: { name: 'join-test' } });
      const { id: channelId } = JSON.parse(createRes.payload);

      const ws = new MockWebSocket() as unknown as WebSocket;
      handleConnection(ws, 'human');

      (ws as unknown as MockWebSocket).emit('message', Buffer.from(JSON.stringify({
        v: 1, id: 'join-1', type: 'channel.join', ts: Date.now(),
        data: { channel_id: channelId },
      })));

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const subCall = calls.find((c: any[]) => {
        try {
          const p = JSON.parse(c[0]);
          return p.type === 'channel.subscribed';
        } catch {
          return false;
        }
      });
      expect(subCall).toBeDefined();
    });
  });

  describe('connection cleanup', () => {
    it('cleans up human members on disconnect', async () => {
      const { app, db } = await buildApp();
      const createRes = await app.inject({ method: 'POST', url: '/api/channels', payload: { name: 'cleanup-test' } });
      const { id: channelId } = JSON.parse(createRes.payload);

      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'human');

      // Join channel first
      db.run('INSERT INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)', [
        channelId, client.id, 'human',
      ]);
      db.save();

      // Verify member exists via direct DB query
      const before = db.prepare('SELECT COUNT(*) as cnt FROM channel_members WHERE channel_id = ?');
      before.bind([channelId]);
      before.step();
      expect((before.getAsObject() as { cnt: number }).cnt).toBe(1);
      before.free();

      // Trigger disconnect
      (ws as unknown as MockWebSocket).emit('close');

      // Verify member was cleaned up via direct DB query
      const after = db.prepare('SELECT COUNT(*) as cnt FROM channel_members WHERE channel_id = ?');
      after.bind([channelId]);
      after.step();
      expect((after.getAsObject() as { cnt: number }).cnt).toBe(0);
      after.free();
    });

    it('removes client from clients map on disconnect', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const client = handleConnection(ws, 'human');

      expect(getClients().has(client.id)).toBe(true);
      (ws as unknown as MockWebSocket).emit('close');
      expect(getClients().has(client.id)).toBe(false);
    });
  });
});
