import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase, DatabaseWrapper } from '../db/index.js';

/** A domain member row joined with its group name. */
interface DomainMemberRow {
  group_id: string;
  group_name: string;
  capabilities: string;
  joined_at: number;
}

/** Parse a JSON-serialized capabilities column into a string array. */
export function parseCapabilities(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

/** Load all member groups of a domain ordered by join time (ascending). */
export function getDomainMembers(db: DatabaseWrapper, domainId: string): DomainMemberRow[] {
  const stmt = db.prepare(`
    SELECT dm.group_id, g.name AS group_name, dm.capabilities, dm.joined_at
    FROM domain_members dm
    JOIN groups g ON g.id = dm.group_id
    WHERE dm.domain_id = ?
    ORDER BY dm.joined_at ASC
  `);
  stmt.bind([domainId]);
  const members: DomainMemberRow[] = [];
  while (stmt.step()) {
    members.push(stmt.getAsObject() as unknown as DomainMemberRow);
  }
  stmt.free();
  return members;
}

/**
 * Compute the domain-level reputation of a member group.
 *
 * Single aggregation function (per domain-overall intent): for member group G
 * in domain D, take every reputation record r where r.team_id belongs to G
 * (group_members has (G, r.team_id)) and r.group_id is a member group of D
 * (domain_members has (D, r.group_id)), group records by (team_id, group_id),
 * sum score_delta per pair into one score, then average those scores. Groups
 * with no qualifying records get reputation 0. Real-time computation, no cache.
 */
export function getDomainReputation(
  db: DatabaseWrapper,
  domainId: string,
  groupId: string,
): number {
  const stmt = db.prepare(`
    SELECT COALESCE(AVG(score), 0) AS reputation
    FROM (
      SELECT SUM(r.score_delta) AS score
      FROM reputation_records r
      JOIN group_members gm ON gm.team_id = r.team_id AND gm.group_id = ?
      JOIN domain_members dm ON dm.group_id = r.group_id AND dm.domain_id = ?
      WHERE r.domain_id IS NULL OR r.domain_id = ?
      GROUP BY r.team_id, r.group_id
    )
  `);
  stmt.bind([groupId, domainId, domainId]);
  let reputation = 0;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { reputation: number };
    // Keep two decimal places (e.g. 1.33)
    reputation = Math.round(row.reputation * 100) / 100;
  }
  stmt.free();
  return reputation;
}

/** Check that the domain exists; sends 404 and returns null when it does not. */
export function requireDomain(db: DatabaseWrapper, domainId: string, reply: FastifyReply): boolean {
  const stmt = db.prepare('SELECT id FROM domains WHERE id = ?');
  stmt.bind([domainId]);
  const found = stmt.step();
  stmt.free();
  if (!found) {
    void reply.status(404).send({ error: 'Domain not found' });
    return false;
  }
  return true;
}

/** Check that the group is a domain member; sends 403 when it is not. */
export function requireDomainMember(
  db: DatabaseWrapper,
  domainId: string,
  groupId: string,
  reply: FastifyReply,
): boolean {
  const stmt = db.prepare(
    'SELECT group_id FROM domain_members WHERE domain_id = ? AND group_id = ?',
  );
  stmt.bind([domainId, groupId]);
  const found = stmt.step();
  stmt.free();
  if (!found) {
    void reply.status(403).send({ error: 'Group is not a member of this domain' });
    return false;
  }
  return true;
}

/** Number of consecutive rejected reviews that flags a member group. */
export const MAX_CONSECUTIVE_REJECTIONS = 5;

/**
 * Count the consecutive rejected review events for a member group, newest first.
 *
 * Anomaly detection reuses the group-layer review primitive: take every review
 * event (review_approved / review_rejected) where the event's team belongs to
 * group G (group_members has (G, team_id)) and the event's group is a member
 * group of domain D (domain_members has (D, group_id)), order by recency, and
 * count how many trailing events are rejected. An approved event breaks the
 * streak. Computed in real time, no extra table.
 */
export function getConsecutiveRejections(
  db: DatabaseWrapper,
  domainId: string,
  groupId: string,
): number {
  const stmt = db.prepare(`
    SELECT r.event_type
    FROM reputation_records r
    JOIN group_members gm ON gm.team_id = r.team_id AND gm.group_id = ?
    JOIN domain_members dm ON dm.group_id = r.group_id AND dm.domain_id = ?
    WHERE r.event_type IN ('review_approved', 'review_rejected')
      AND (r.domain_id IS NULL OR r.domain_id = ?)
    ORDER BY r.created_at DESC, r.rowid DESC
  `);
  stmt.bind([groupId, domainId, domainId]);
  let consecutive = 0;
  while (stmt.step()) {
    const row = stmt.getAsObject() as { event_type: string };
    if (row.event_type === 'review_rejected') {
      consecutive++;
    } else {
      // An approval breaks the streak.
      break;
    }
  }
  stmt.free();
  return consecutive;
}

/** Register domain capability / discovery / reputation routes. */
export async function registerDomainCapabilityRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/domains/:id/capabilities — member group updates its capability declaration
  app.post(
    '/api/domains/:id/capabilities',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { group_id?: string; capabilities?: unknown };

      const db = getDatabase();

      if (!requireDomain(db, id, reply)) return reply;

      if (!body.group_id || typeof body.group_id !== 'string') {
        return reply.status(400).send({ error: 'group_id is required' });
      }
      if (!requireDomainMember(db, id, body.group_id, reply)) return reply;

      // capabilities must be an array of strings (empty array clears the declaration)
      const capabilities = body.capabilities;
      if (!Array.isArray(capabilities) || capabilities.some((c) => typeof c !== 'string')) {
        return reply.status(400).send({ error: 'capabilities must be an array of strings' });
      }
      const caps: string[] = capabilities;

      db.run('UPDATE domain_members SET capabilities = ? WHERE domain_id = ? AND group_id = ?', [
        JSON.stringify(caps),
        id,
        body.group_id,
      ]);
      db.save();

      return { success: true };
    },
  );

  // GET /api/domains/:id/capabilities — list all members' capability declarations
  app.get('/api/domains/:id/capabilities', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    if (!requireDomain(db, id, reply)) return reply;

    const members = getDomainMembers(db, id);
    return members.map((m) => ({
      group_id: m.group_id,
      group_name: m.group_name,
      capabilities: parseCapabilities(m.capabilities),
    }));
  });

  // GET /api/domains/:id/discover — capability discovery with reputation ordering
  app.get('/api/domains/:id/discover', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { capabilities?: string; group_id?: string };

    const db = getDatabase();

    if (!requireDomain(db, id, reply)) return reply;

    if (!query.group_id || typeof query.group_id !== 'string') {
      return reply.status(400).send({ error: 'group_id query param is required' });
    }
    if (!requireDomainMember(db, id, query.group_id, reply)) return reply;

    // Parse required capabilities (comma-separated; empty or absent → [])
    const required: string[] = query.capabilities
      ? query.capabilities
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

    const results: Array<{
      group_id: string;
      group_name: string;
      capabilities: string[];
      reputation: number;
      joined_at: number;
    }> = [];
    for (const m of getDomainMembers(db, id)) {
      const declared = parseCapabilities(m.capabilities);
      // Subset match: required ⊆ declared (empty required matches every member)
      const matches = required.length === 0 || required.every((c) => declared.includes(c));
      if (!matches) continue;
      results.push({
        group_id: m.group_id,
        group_name: m.group_name,
        capabilities: declared,
        reputation: getDomainReputation(db, id, m.group_id),
        joined_at: m.joined_at,
      });
    }

    // Sort by reputation desc, ties broken by join time asc (stable ordering)
    results.sort((a, b) => b.reputation - a.reputation || a.joined_at - b.joined_at);
    return results.map((r) => ({
      group_id: r.group_id,
      group_name: r.group_name,
      capabilities: r.capabilities,
      reputation: r.reputation,
      flagged: getConsecutiveRejections(db, id, r.group_id) >= MAX_CONSECUTIVE_REJECTIONS,
    }));
  });

  // GET /api/domains/:id/reputation — domain-level reputation for all member groups
  app.get('/api/domains/:id/reputation', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { group_id?: string };

    const db = getDatabase();

    if (!requireDomain(db, id, reply)) return reply;

    if (!query.group_id || typeof query.group_id !== 'string') {
      return reply.status(400).send({ error: 'group_id query param is required' });
    }
    if (!requireDomainMember(db, id, query.group_id, reply)) return reply;

    const results = getDomainMembers(db, id).map((m) => ({
      group_id: m.group_id,
      group_name: m.group_name,
      reputation: getDomainReputation(db, id, m.group_id),
      joined_at: m.joined_at,
    }));

    // Sort by reputation desc, ties broken by join time asc (stable ordering)
    results.sort((a, b) => b.reputation - a.reputation || a.joined_at - b.joined_at);
    return results.map((r) => ({
      group_id: r.group_id,
      group_name: r.group_name,
      reputation: r.reputation,
      flagged: getConsecutiveRejections(db, id, r.group_id) >= MAX_CONSECUTIVE_REJECTIONS,
    }));
  });
}
