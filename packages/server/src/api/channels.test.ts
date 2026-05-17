import { describe, it, expect } from 'vitest';
import { buildApp } from '../test-helpers.js';
import {
  getOrCreateDmChannel,
  addChannelMember,
  removeChannelMember,
  getChannelMembers,
  getMemberChannels,
  ensureDefaultChannel,
} from './channels.js';

describe('Channels API', () => {
  describe('POST /api/channels', () => {
    it('creates a group channel', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'test-channel', description: 'A test channel' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('test-channel');
      expect(body.type).toBe('group');
    });

    it('creates a task channel', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'task-ch', type: 'task' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.type).toBe('task');
    });

    it('rejects missing name', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid type', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'x', type: 'invalid' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/channels/dm', () => {
    it('creates a DM channel', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/dm',
        payload: { member1Id: 'h1', member1Kind: 'human', member2Id: 'a1', member2Kind: 'agent' },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      expect(body.name).toMatch(/^dm:/);
    });

    it('reuses existing DM channel', async () => {
      const { app } = await buildApp();
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/channels/dm',
        payload: { member1Id: 'u1', member1Kind: 'human', member2Id: 'u2', member2Kind: 'human' },
      });
      const body1 = JSON.parse(res1.payload);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/channels/dm',
        payload: { member1Id: 'u1', member1Kind: 'human', member2Id: 'u2', member2Kind: 'human' },
      });
      const body2 = JSON.parse(res2.payload);

      expect(body1.id).toBe(body2.id);
    });

    it('rejects missing fields', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/dm',
        payload: { member1Id: 'h1' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid member kind', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/dm',
        payload: { member1Id: 'h1', member1Kind: 'bot', member2Id: 'a1', member2Kind: 'agent' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/channels', () => {
    it('lists channels', async () => {
      const { app } = await buildApp();
      await app.inject({ method: 'POST', url: '/api/channels', payload: { name: 'ch1' } });

      const res = await app.inject({ method: 'GET', url: '/api/channels' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.channels).toBeInstanceOf(Array);
      expect(body.channels.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by type', async () => {
      const { app } = await buildApp();
      await app.inject({ method: 'POST', url: '/api/channels', payload: { name: 't1', type: 'task' } });

      const res = await app.inject({ method: 'GET', url: '/api/channels?type=task' });
      const body = JSON.parse(res.payload);
      expect(body.channels.every((c: { type: string }) => c.type === 'task')).toBe(true);
    });
  });

  describe('GET /api/channels/:id', () => {
    it('returns channel details', async () => {
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'detail-ch' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'GET', url: `/api/channels/${id}` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(id);
    });

    it('returns 404 for non-existent channel', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/channels/non-existent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/channels/:id/members', () => {
    it('lists channel members', async () => {
      const { app, db } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'member-ch' },
      });
      const { id } = JSON.parse(createRes.payload);

      // Add a member
      db.run('INSERT INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)', [
        id,
        'user-1',
        'human',
      ]);
      db.save();

      const res = await app.inject({ method: 'GET', url: `/api/channels/${id}/members` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.members).toBeInstanceOf(Array);
      expect(body.members.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent channel', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/channels/non-existent/members' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/channels/:id/members', () => {
    it('adds a member to channel', async () => {
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'add-member-ch' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({
        method: 'POST',
        url: `/api/channels/${id}/members`,
        payload: { memberId: 'u1', memberKind: 'human' },
      });
      expect(res.statusCode).toBe(201);

      const getRes = await app.inject({ method: 'GET', url: `/api/channels/${id}/members` });
      const body = JSON.parse(getRes.payload);
      expect(body.members.some((m: { memberId: string }) => m.memberId === 'u1')).toBe(true);
    });

    it('returns 404 for non-existent channel', async () => {
      const { app } = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/non-existent/members',
        payload: { memberId: 'u1', memberKind: 'human' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/channels/:id/members/:memberId', () => {
    it('removes a member from channel', async () => {
      const { app, db } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'remove-member-ch' },
      });
      const { id } = JSON.parse(createRes.payload);

      db.run('INSERT INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)', [
        id,
        'u1',
        'human',
      ]);
      db.save();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/channels/${id}/members/u1`,
      });
      expect(res.statusCode).toBe(200);

      const getRes = await app.inject({ method: 'GET', url: `/api/channels/${id}/members` });
      const body = JSON.parse(getRes.payload);
      expect(body.members.some((m: { memberId: string }) => m.memberId === 'u1')).toBe(false);
    });
  });

  describe('DELETE /api/channels/:id', () => {
    it('deletes a channel and its members', async () => {
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'to-delete' },
      });
      const { id } = JSON.parse(createRes.payload);

      const res = await app.inject({ method: 'DELETE', url: `/api/channels/${id}` });
      expect(res.statusCode).toBe(200);

      const getRes = await app.inject({ method: 'GET', url: `/api/channels/${id}` });
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 for non-existent channel', async () => {
      const { app } = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: '/api/channels/non-existent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Channel utility functions', () => {
    it('ensureDefaultChannel creates general if missing', async () => {
      await buildApp();
      ensureDefaultChannel();
      // Should not throw; idempotent
      ensureDefaultChannel();
    });

    it('getOrCreateDmChannel creates and reuses DM', async () => {
      await buildApp();
      const dm1 = getOrCreateDmChannel('h1', 'human', 'a1', 'agent');
      const dm2 = getOrCreateDmChannel('h1', 'human', 'a1', 'agent');
      expect(dm1.id).toBe(dm2.id);
    });

    it('addChannelMember and removeChannelMember work', async () => {
      await buildApp();
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'util-ch' },
      });
      const { id } = JSON.parse(createRes.payload);

      addChannelMember(id, 'u1', 'human');
      let members = getChannelMembers(id);
      expect(members.some((m) => m.memberId === 'u1')).toBe(true);

      removeChannelMember(id, 'u1');
      members = getChannelMembers(id);
      expect(members.some((m) => m.memberId === 'u1')).toBe(false);
    });

    it('getMemberChannels returns channels for a member', async () => {
      await buildApp();
      const { app } = await buildApp();
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/channels',
        payload: { name: 'member-ch-2' },
      });
      const { id } = JSON.parse(createRes.payload);

      addChannelMember(id, 'u1', 'human');
      const channels = getMemberChannels('u1');
      expect(channels.some((c) => c.id === id)).toBe(true);
    });
  });
});
