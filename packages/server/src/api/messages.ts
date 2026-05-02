import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { getDatabase } from '../db/index.js';
import { getAgentById } from './agents.js';
import { getClients } from '../ws/handler.js';

import type { Message } from '@agent-chat-box/shared';

/** Resolve senderName for a message */
function resolveSenderName(msg: Message): Message {
  if (msg.senderName) return msg;
  if (msg.senderKind === 'agent') {
    const agent = getAgentById(msg.senderId);
    if (agent) msg.senderName = agent.name;
  } else if (msg.senderKind === 'human') {
    const clients = getClients();
    for (const client of clients.values()) {
      if (client.type === 'human' && client.id === msg.senderId && client.name) {
        msg.senderName = client.name;
        break;
      }
    }
  }
  return msg;
}

/** Save message to database */
export function saveMessage(data: {
  channelId: string;
  senderId: string;
  senderKind: 'human' | 'agent' | 'system';
  senderName?: string;
  content: string;
  mentions?: string[];
  replyTo?: string;
  attachments?: Array<{ id: string; url: string; name: string; mime: string; size: number }>;
}): Message {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO messages (id, channel_id, sender_id, sender_kind, sender_name, content, mentions, reply_to, attachments, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.channelId,
      data.senderId,
      data.senderKind,
      data.senderName || null,
      data.content,
      data.mentions ? JSON.stringify(data.mentions) : null,
      data.replyTo || null,
      data.attachments ? JSON.stringify(data.attachments) : null,
      now,
    ]
  );
  db.save();

  return {
    id,
    channelId: data.channelId,
    senderId: data.senderId,
    senderKind: data.senderKind,
    senderName: data.senderName,
    content: data.content,
    mentions: data.mentions,
    replyTo: data.replyTo,
    attachments: data.attachments,
    createdAt: now,
  };
}

/** Get recent messages for a channel */
export function getRecentMessages(channelId: string, limit: number = 50): Message[] {
  const db = getDatabase();
  const messages: Message[] = [];
  const stmt = db.prepare(
    'SELECT id, channel_id, sender_id, sender_kind, sender_name, content, mentions, reply_to, attachments, created_at FROM messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?'
  );
  stmt.bind([channelId, limit]);

  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    messages.push({
      id: row.id as string,
      channelId: row.channel_id as string,
      senderId: row.sender_id as string,
      senderKind: row.sender_kind as Message['senderKind'],
      senderName: row.sender_name as string | undefined,
      content: row.content as string,
      mentions: row.mentions ? JSON.parse(row.mentions as string) : undefined,
      replyTo: row.reply_to as string | undefined,
      attachments: row.attachments ? JSON.parse(row.attachments as string) : undefined,
      createdAt: row.created_at as number,
    });
  }
  stmt.free();

  return messages.reverse().map(resolveSenderName); // Oldest first
}

/** Register message API routes */
export async function registerMessageRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/channels/:id/messages — get channel messages
  app.get('/api/channels/:id/messages', async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; before?: string; after?: string };

    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const db = getDatabase();

    let sql = 'SELECT id, channel_id, sender_id, sender_kind, sender_name, content, mentions, reply_to, attachments, created_at FROM messages WHERE channel_id = ?';
    const params: unknown[] = [id];

    if (query.before) {
      sql += ' AND created_at < ?';
      params.push(parseInt(query.before, 10));
    }
    if (query.after) {
      sql += ' AND created_at > ?';
      params.push(parseInt(query.after, 10));
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const messages: Message[] = [];
    const stmt = db.prepare(sql);
    stmt.bind(params);

    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      messages.push({
        id: row.id as string,
        channelId: row.channel_id as string,
        senderId: row.sender_id as string,
        senderKind: row.sender_kind as Message['senderKind'],
        senderName: row.sender_name as string | undefined,
        content: row.content as string,
        mentions: row.mentions ? JSON.parse(row.mentions as string) : undefined,
        replyTo: row.reply_to as string | undefined,
        attachments: row.attachments ? JSON.parse(row.attachments as string) : undefined,
        createdAt: row.created_at as number,
      });
    }
    stmt.free();

    return { messages: messages.reverse().map(resolveSenderName) }; // Oldest first
  });
}
