import { describe, it, expect } from 'vitest';
import { buildApp } from '../test-helpers.js';
import { saveMessage, getRecentMessages } from './messages.js';

describe('Messages API', () => {
  describe('POST /api/channels/:id/messages (via saveMessage)', () => {
    it('saves a message with all fields', async () => {
      await buildApp();
      const msg = saveMessage({
        channelId: 'ch-1',
        senderId: 'user-1',
        senderKind: 'human',
        senderName: 'Alice',
        content: 'Hello world',
        mentions: ['user-2'],
        replyTo: 'msg-prev',
      });

      expect(msg.id).toBeDefined();
      expect(msg.channelId).toBe('ch-1');
      expect(msg.senderName).toBe('Alice');
      expect(msg.content).toBe('Hello world');
      expect(msg.mentions).toEqual(['user-2']);
      expect(msg.replyTo).toBe('msg-prev');
    });

    it('saves a system message', async () => {
      await buildApp();
      const msg = saveMessage({
        channelId: 'ch-1',
        senderId: 'system',
        senderKind: 'system',
        content: 'Task completed',
      });

      expect(msg.senderKind).toBe('system');
      expect(msg.senderName).toBeUndefined();
    });

    it('saves a message with attachments', async () => {
      await buildApp();
      const attachments = [{ id: 'att-1', url: '/uploads/1', name: 'file.txt', mime: 'text/plain', size: 1024 }];
      const msg = saveMessage({
        channelId: 'ch-1',
        senderId: 'user-1',
        senderKind: 'human',
        content: 'See attachment',
        attachments,
      });

      expect(msg.attachments).toEqual(attachments);
    });
  });

  describe('GET /api/channels/:id/messages', () => {
    it('returns messages for a channel', async () => {
      const { app } = await buildApp();
      // Save some messages
      saveMessage({ channelId: 'ch-test', senderId: 'u1', senderKind: 'human', content: 'msg1' });
      saveMessage({ channelId: 'ch-test', senderId: 'u2', senderKind: 'human', content: 'msg2' });

      const res = await app.inject({ method: 'GET', url: '/api/channels/ch-test/messages' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.messages).toBeInstanceOf(Array);
      expect(body.messages.length).toBe(2);
      // Oldest first
      expect(body.messages[0].content).toBe('msg1');
      expect(body.messages[1].content).toBe('msg2');
    });

    it('supports limit query', async () => {
      const { app } = await buildApp();
      for (let i = 0; i < 10; i++) {
        saveMessage({ channelId: 'ch-limit', senderId: 'u1', senderKind: 'human', content: `msg${i}` });
      }

      const res = await app.inject({ method: 'GET', url: '/api/channels/ch-limit/messages?limit=3' });
      const body = JSON.parse(res.payload);
      expect(body.messages.length).toBe(3);
    });

    it('supports before/after query', async () => {
      const { app } = await buildApp();
      const now = Date.now();
      saveMessage({ channelId: 'ch-time', senderId: 'u1', senderKind: 'human', content: 'old' });
      saveMessage({ channelId: 'ch-time', senderId: 'u1', senderKind: 'human', content: 'new' });

      const res = await app.inject({ method: 'GET', url: `/api/channels/ch-time/messages?after=${now - 1000}` });
      const body = JSON.parse(res.payload);
      expect(body.messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRecentMessages', () => {
    it('returns recent messages oldest first', async () => {
      await buildApp();
      saveMessage({ channelId: 'ch-recent', senderId: 'u1', senderKind: 'human', content: 'first' });
      saveMessage({ channelId: 'ch-recent', senderId: 'u1', senderKind: 'human', content: 'second' });

      const msgs = getRecentMessages('ch-recent', 50);
      expect(msgs.length).toBe(2);
      expect(msgs[0].content).toBe('first');
      expect(msgs[1].content).toBe('second');
    });

    it('respects limit', async () => {
      await buildApp();
      for (let i = 0; i < 10; i++) {
        saveMessage({ channelId: 'ch-limit2', senderId: 'u1', senderKind: 'human', content: `msg${i}` });
      }

      const msgs = getRecentMessages('ch-limit2', 3);
      expect(msgs.length).toBe(3);
    });

    it('resolves sender names for agents', async () => {
      const { app, db } = await buildApp();
      // Create an agent
      db.run(
        'INSERT INTO agents (id, machine_id, name, runtime, capabilities, role_card, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['agent-1', 'm1', 'TestBot', 'claude', '[]', '{"name":"TestBot"}', 'sleeping'],
      );
      db.save();

      saveMessage({ channelId: 'ch-name', senderId: 'agent-1', senderKind: 'agent', content: 'hi' });
      const msgs = getRecentMessages('ch-name', 10);
      expect(msgs[0].senderName).toBe('TestBot');
    });
  });
});
