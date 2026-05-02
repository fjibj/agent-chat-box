import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, getDefaultChannelId } from '../helpers.js';
import { saveMessage, getRecentMessages } from '../../packages/server/src/api/messages.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let channelId: string;

beforeAll(async () => {
  app = await createTestApp();
  channelId = await getDefaultChannelId(app);
});

afterAll(async () => {
  await app.close();
});

describe('Message API', () => {
  it('saveMessage + getRecentMessages — round-trip', () => {
    const msg = saveMessage({
      channelId,
      senderId: 'test-user',
      senderKind: 'human',
      content: 'Hello world',
    });

    expect(msg.id).toBeDefined();
    expect(msg.content).toBe('Hello world');
    expect(msg.channelId).toBe(channelId);
    expect(msg.createdAt).toBeGreaterThan(0);

    const messages = getRecentMessages(channelId, 10);
    const found = messages.find((m) => m.id === msg.id);
    expect(found).toBeDefined();
    expect(found!.content).toBe('Hello world');
  });

  it('saveMessage — with mentions and replyTo', () => {
    const msg = saveMessage({
      channelId,
      senderId: 'agent-1',
      senderKind: 'agent',
      content: '@user check this',
      mentions: ['user-1'],
      replyTo: 'some-msg-id',
    });

    expect(msg.mentions).toEqual(['user-1']);
    expect(msg.replyTo).toBe('some-msg-id');
  });

  it('GET /api/channels/:id/messages — get channel messages', async () => {
    // Insert a message first
    saveMessage({
      channelId,
      senderId: 'test-user',
      senderKind: 'human',
      content: 'API test message',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}/messages`,
    });
    expect(res.statusCode).toBe(200);
    const { messages } = res.json();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/channels/:id/messages?limit=1 — limit results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}/messages?limit=1`,
    });
    expect(res.statusCode).toBe(200);
    const { messages } = res.json();
    expect(messages.length).toBeLessThanOrEqual(1);
  });

  it('GET /api/channels/:id/messages — empty channel returns empty', async () => {
    // Create a new channel (no messages)
    const chanRes = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'empty-msg-channel' },
    });
    const emptyChannelId = chanRes.json().id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${emptyChannelId}/messages`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toEqual([]);
  });
});
