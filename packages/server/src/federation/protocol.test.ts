import { describe, it, expect } from 'vitest';
import { buildFedMsg, parseFedMsg, genFedMsgId, type FederationMessage } from './protocol.js';

describe('Federation Protocol', () => {
  describe('buildFedMsg', () => {
    it('creates a valid federation message envelope', () => {
      const msg = buildFedMsg('federation.register', 'team-a', { inviteCode: 'ABC123' });

      expect(msg.v).toBe(1);
      expect(msg.id).toMatch(/^fed_/);
      expect(msg.type).toBe('federation.register');
      expect(msg.ts).toBeGreaterThan(0);
      expect(msg.from).toBe('team-a');
      expect(msg.to).toBeUndefined();
      expect(msg.data).toEqual({ inviteCode: 'ABC123' });
    });

    it('supports optional to field for point-to-point routing', () => {
      const msg = buildFedMsg('federation.agent.wake', 'hub', { agentId: 'a1' }, 'team-b');
      expect(msg.to).toBe('team-b');
    });

    it('generates unique message IDs', () => {
      const msg1 = buildFedMsg('federation.heartbeat', 'team-a', {});
      const msg2 = buildFedMsg('federation.heartbeat', 'team-a', {});
      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe('parseFedMsg', () => {
    it('parses a valid federation message', () => {
      const original = buildFedMsg('federation.heartbeat', 'team-a', { timestamp: 12345 });
      const parsed = parseFedMsg(JSON.stringify(original));

      expect(parsed).not.toBeNull();
      expect(parsed!.v).toBe(1);
      expect(parsed!.type).toBe('federation.heartbeat');
      expect(parsed!.from).toBe('team-a');
      expect((parsed!.data as { timestamp: number }).timestamp).toBe(12345);
    });

    it('rejects invalid JSON', () => {
      const parsed = parseFedMsg('not json at all');
      expect(parsed).toBeNull();
    });

    it('rejects messages missing required fields', () => {
      expect(parseFedMsg(JSON.stringify({ v: 1, id: 'x', type: 'federation.x' }))).toBeNull(); // missing ts, from
      expect(parseFedMsg(JSON.stringify({ v: 1, id: 'x', type: 'federation.x', ts: 1 }))).toBeNull(); // missing from
      expect(parseFedMsg(JSON.stringify({ id: 'x', type: 'federation.x', ts: 1, from: 'a' }))).toBeNull(); // missing v
    });

    it('rejects messages without federation prefix', () => {
      const parsed = parseFedMsg(JSON.stringify({ v: 1, id: 'x', type: 'agent.register', ts: 1, from: 'a' }));
      expect(parsed).toBeNull();
    });

    it('accepts all defined message types', () => {
      const types = [
        'federation.register',
        'federation.register.result',
        'federation.heartbeat',
        'federation.member.joined',
        'federation.member.left',
        'federation.task.broadcast',
        'federation.task.claim',
        'federation.agent.wake',
        'federation.member.leave',
      ];

      for (const type of types) {
        const msg = buildFedMsg(type as any, 'test', {});
        expect(parseFedMsg(JSON.stringify(msg))).not.toBeNull();
      }
    });
  });

  describe('genFedMsgId', () => {
    it('generates IDs with fed_ prefix', () => {
      const id = genFedMsgId();
      expect(id).toMatch(/^fed_/);
    });

    it('generates unique IDs across multiple calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(genFedMsgId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
