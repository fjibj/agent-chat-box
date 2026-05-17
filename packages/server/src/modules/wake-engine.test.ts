import { describe, it, expect } from 'vitest';
import { buildApp, createMachine, createAgent } from '../test-helpers.js';
import {
  shouldWakeAgent,
  wakeAgent,
  sleepAgent,
  checkAndWakeAgents,
  updateAgentStatus,
} from './wake-engine.js';

// Automate: Unit Tests for Wake Engine
// Covers P0-P2: Agent wake/sleep logic

describe('Wake Engine Unit Tests', () => {
  describe('updateAgentStatus', () => {
    it('updates agent status to awake with timestamp', async () => {
      const { app, db } = await buildApp();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      updateAgentStatus(agent.id, 'awake');

      const stmt = db.prepare('SELECT status, last_wake_at FROM agents WHERE id = ?');
      stmt.bind([agent.id]);
      expect(stmt.step()).toBe(true);
      const row = stmt.getAsObject() as { status: string; last_wake_at: number };
      stmt.free();

      expect(row.status).toBe('awake');
      expect(row.last_wake_at).toBeGreaterThan(0);
    });

    it('updates agent status to sleeping with timestamp', async () => {
      const { app, db } = await buildApp();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      updateAgentStatus(agent.id, 'sleeping');

      const stmt = db.prepare('SELECT status, last_sleep_at FROM agents WHERE id = ?');
      stmt.bind([agent.id]);
      expect(stmt.step()).toBe(true);
      const row = stmt.getAsObject() as { status: string; last_sleep_at: number };
      stmt.free();

      expect(row.status).toBe('sleeping');
      expect(row.last_sleep_at).toBeGreaterThan(0);
    });
  });

  describe('shouldWakeAgent', () => {
    it('returns true when agent is @mentioned by id', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      // Set agent to sleeping
      updateAgentStatus(agent.id, 'sleeping');

      const result = shouldWakeAgent(agent.id, {
        id: 'msg-1',
        channelId: 'ch-1',
        senderId: 'user-1',
        content: 'Hey @' + agent.id,
        mentions: [agent.id],
        createdAt: Date.now(),
      });

      expect(result).toBe(true);
    });

    it('returns true when agent is @mentioned by name', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      updateAgentStatus(agent.id, 'sleeping');

      const result = shouldWakeAgent(agent.id, {
        id: 'msg-1',
        channelId: 'ch-1',
        senderId: 'user-1',
        content: 'Hey @A1',
        mentions: ['A1'],
        createdAt: Date.now(),
      });

      expect(result).toBe(true);
    });

    it('returns false when agent is already awake', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      // Agent defaults to sleeping; wake it
      updateAgentStatus(agent.id, 'awake');

      const result = shouldWakeAgent(agent.id, {
        id: 'msg-1',
        channelId: 'ch-1',
        senderId: 'user-1',
        content: 'Hey @A1',
        mentions: ['A1'],
        createdAt: Date.now(),
      });

      expect(result).toBe(false);
    });

    it('returns false when agent not mentioned', async () => {
      const { app } = await buildApp();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      updateAgentStatus(agent.id, 'sleeping');

      const result = shouldWakeAgent(agent.id, {
        id: 'msg-1',
        channelId: 'ch-1',
        senderId: 'user-1',
        content: 'Hello everyone',
        mentions: [],
        createdAt: Date.now(),
      });

      expect(result).toBe(false);
    });

    it('returns false for non-existent agent', async () => {
      await buildApp();
      const result = shouldWakeAgent('non-existent', {
        id: 'msg-1',
        channelId: 'ch-1',
        senderId: 'user-1',
        content: 'Hello',
        mentions: [],
        createdAt: Date.now(),
      });
      expect(result).toBe(false);
    });
  });

  describe('checkAndWakeAgents', () => {
    it('wakes sleeping agents mentioned in channel', async () => {
      const { app, db } = await buildApp();
      const channelId = 'ch-general';
      db.run('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)', [channelId, '#general', 0]);
      db.save();
      const machine = await createMachine(app, 'M1');
      const agent = await createAgent(app, machine.id, 'A1', 'claude');

      // Set agent to sleeping and add to channel
      updateAgentStatus(agent.id, 'sleeping');
      db.run('INSERT INTO channel_members (channel_id, member_id, member_kind, joined_at) VALUES (?, ?, ?, ?)', [
        channelId, agent.id, 'agent', Date.now(),
      ]);
      db.save();

      checkAndWakeAgents(channelId, {
        id: 'msg-1',
        channelId,
        senderId: 'user-1',
        content: 'Hey @A1',
        mentions: ['A1'],
        createdAt: Date.now(),
      });

      const stmt = db.prepare('SELECT status FROM agents WHERE id = ?');
      stmt.bind([agent.id]);
      expect(stmt.step()).toBe(true);
      const row = stmt.getAsObject() as { status: string };
      stmt.free();

      expect(row.status).toBe('awake');
    });
  });
});
