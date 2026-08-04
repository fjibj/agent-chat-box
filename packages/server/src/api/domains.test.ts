import { describe, it, expect } from 'vitest';
import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildApp, createTeam, createGroup, createDomain } from '../test-helpers.js';
import { DatabaseWrapper, migrate, setDatabase } from '../db/index.js';

// IDSD Slice 1: Domain data model & registration API
// Domain lifecycle is isomorphic to groups (G005-G009), with groups as members.

describe('IDSD-S1: DB Migration v9→v10', () => {
  it('TC-D001-001: migration creates domains and domain_members tables', async () => {
    const { db } = await buildApp();
    const domainsInfo = db.exec('PRAGMA table_info(domains)');
    expect(domainsInfo.length).toBeGreaterThan(0);
    const domainColumns = domainsInfo[0].values.map((v) => v[1]);
    expect(domainColumns).toContain('id');
    expect(domainColumns).toContain('name');
    expect(domainColumns).toContain('contract_yaml');
    expect(domainColumns).toContain('owner_group_id');
    expect(domainColumns).toContain('invite_code');
    expect(domainColumns).toContain('invite_code_expires_at');
    expect(domainColumns).toContain('invite_code_max_uses');
    expect(domainColumns).toContain('invite_code_uses');

    const membersInfo = db.exec('PRAGMA table_info(domain_members)');
    expect(membersInfo.length).toBeGreaterThan(0);
    const memberColumns = membersInfo[0].values.map((v) => v[1]);
    expect(memberColumns).toContain('domain_id');
    expect(memberColumns).toContain('group_id');
    expect(memberColumns).toContain('role');
    expect(memberColumns).toContain('capabilities');
    expect(memberColumns).toContain('joined_at');

    const versionResult = db.exec('PRAGMA user_version');
    expect(versionResult[0].values[0][0]).toBe(12);
  });

  it('TC-D001-003: v11 → v12 migration adds domain_id to reputation_records', async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm',
    );
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const raw = new SQL.Database();

    // Build a minimal v11 database: reputation_records without domain_id
    raw.run(`
      CREATE TABLE reputation_records (
        id TEXT PRIMARY KEY,
        team_id TEXT,
        group_id TEXT,
        event_type TEXT NOT NULL,
        score_delta INTEGER NOT NULL,
        task_id TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `);
    raw.run(
      "INSERT INTO reputation_records (id, team_id, group_id, event_type, score_delta) VALUES ('r1', 'team-1', 'group-1', 'task_completed', 1)",
    );
    raw.run('PRAGMA user_version = 11;');

    const db = new DatabaseWrapper(raw);
    setDatabase(db);
    migrate(db);

    // Version bumped to 12
    const versionResult = db.exec('PRAGMA user_version');
    expect(versionResult[0].values[0][0]).toBe(12);

    // domain_id column added
    const cols = db.exec('PRAGMA table_info(reputation_records)')[0].values.map((v) => v[1]);
    expect(cols).toContain('domain_id');

    // Existing rows are backfilled as NULL (group-level events)
    const rowStmt = db.prepare('SELECT domain_id FROM reputation_records WHERE id = ?');
    rowStmt.bind(['r1']);
    expect(rowStmt.step()).toBe(true);
    const row = rowStmt.getAsObject() as { domain_id: string | null };
    rowStmt.free();
    expect(row.domain_id).toBeNull();
  });
});

describe('IDSD-S1: Domain CRUD API', () => {
  it('TC-D002-001: create domain auto-adds owner group as member with role owner', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/domains',
      payload: { name: 'Research Alliance', owner_group_id: group.id },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.owner_group_id).toBe(group.id);
    expect(body.created_at).toBeDefined();

    // Verify owner group is in members with role=owner
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${body.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const domain = JSON.parse(getRes.payload);
    const memberGroupIds = domain.members.map((m: { group_id: string }) => m.group_id);
    expect(memberGroupIds).toContain(group.id);
    const ownerMember = domain.members.find(
      (m: { group_id: string; role: string }) => m.group_id === group.id,
    );
    expect(ownerMember.role).toBe('owner');
  });

  it('TC-D002-002: create domain rejects missing name', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/domains',
      payload: { owner_group_id: group.id },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('name is required');
  });

  it('TC-D002-003: create domain rejects missing owner_group_id', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/domains',
      payload: { name: 'No Owner' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('owner_group_id is required');
  });

  it('TC-D002-004: create domain rejects unknown owner group', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/domains',
      payload: { name: 'Ghost', owner_group_id: 'group-does-not-exist' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('Owner group not found');
  });

  it('TC-D002-005: GET /api/domains lists domains for a group', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains?group_id=${group.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(domain.id);
  });

  it('TC-D002-006: GET /api/domains requires group_id', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/domains',
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('group_id query param is required');
  });

  it('TC-D002-007: group with no domains gets empty list', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Lonely Guild', team.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains?group_id=${group.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual([]);
  });

  it('TC-D002-008: GET /api/domains/:id returns detail with members incl. group_name', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id, 'desc here');

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe('Alliance');
    expect(body.description).toBe('desc here');
    expect(body.owner_group_id).toBe(group.id);
    expect(body.members.length).toBe(1);
    expect(body.members[0].group_name).toBe('Guild A');
    expect(body.members[0].role).toBe('owner');
  });

  it('TC-D002-009: GET /api/domains/:id returns 404 for unknown domain', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/domains/domain-does-not-exist',
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('Domain not found');
  });
});

describe('IDSD-S1: Invite Codes & Join Domain', () => {
  it('TC-D003-001: POST /api/domains/:id/invite generates 8-char invite code', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Host', 'user-1');
    const group = await createGroup(app, 'Host Guild', team.id);
    const domain = await createDomain(app, 'Invite Domain', group.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/invite`,
      payload: { max_uses: 5, expires_in_hours: 48 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.invite_code).toBeDefined();
    expect(body.invite_code.length).toBe(8);
    expect(body.invite_code).toBe(body.invite_code.toUpperCase());
    expect(body.max_uses).toBe(5);
    expect(body.expires_at).toBeDefined();
  });

  it('TC-D003-002: POST /api/domains/join succeeds with valid invite code', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Open Domain', groupA.id);

    // Generate invite code directly
    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DOMVALID', now + 3600, 5, domain.id],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMVALID', group_id: groupB.id, capabilities: ['code', 'test'] },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.domain_id).toBe(domain.id);

    // Verify group B is now a member with stored capabilities
    const getRes = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}` });
    const dom = JSON.parse(getRes.payload);
    const memberIds = dom.members.map((m: { group_id: string }) => m.group_id);
    expect(memberIds).toContain(groupB.id);
    const memberB = dom.members.find((m: { group_id: string }) => m.group_id === groupB.id);
    expect(memberB.role).toBe('member');
    expect(memberB.capabilities).toBe('["code","test"]');

    // Verify invite code uses incremented
    const domainStmt = db.prepare('SELECT invite_code_uses FROM domains WHERE id = ?');
    domainStmt.bind([domain.id]);
    domainStmt.step();
    const domainRow = domainStmt.getAsObject() as { invite_code_uses: number };
    domainStmt.free();
    expect(domainRow.invite_code_uses).toBe(1);
  });

  it('TC-D003-003: invalid invite code rejected', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Team A', 'user-a');
    const group = await createGroup(app, 'Guild A', team.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'NOPE0000', group_id: group.id },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('Invalid invite code');
  });

  it('TC-D003-004: expired invite code rejected', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Expired Domain', groupA.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DOMEXP01', now - 3600, null, domain.id],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMEXP01', group_id: groupB.id },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('expired');
  });

  it('TC-D003-005: max uses invite code rejected after limit', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Limited Domain', groupA.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = ? WHERE id = ?',
      ['DOMLIM01', now + 3600, 1, 1, domain.id],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMLIM01', group_id: groupB.id },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('maximum uses');
  });

  it('TC-D003-006: duplicate join is rejected', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Closed Domain', groupA.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DOMDUP01', now + 3600, 5, domain.id],
    );

    // First join
    const first = await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMDUP01', group_id: groupB.id },
    });
    expect(first.statusCode).toBe(200);

    // Second join attempt
    const res = await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMDUP01', group_id: groupB.id },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('already in this domain');
  });

  it('TC-D003-007: join rejects missing group_id', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMVALID' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('group_id is required');
  });
});

describe('IDSD-S1: Multi-domain membership & leave', () => {
  it('TC-D004-001: a group can join multiple domains independently', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain1 = await createDomain(app, 'Domain 1', groupA.id);
    const domain2 = await createDomain(app, 'Domain 2', groupA.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DOMONE01', now + 3600, 5, domain1.id],
    );
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DOMTWO01', now + 3600, 5, domain2.id],
    );

    await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMONE01', group_id: groupB.id },
    });
    await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMTWO01', group_id: groupB.id },
    });

    // Both domains contain group B, and group B lists both domains
    const d1 = JSON.parse(
      (await app.inject({ method: 'GET', url: `/api/domains/${domain1.id}` })).payload,
    );
    const d2 = JSON.parse(
      (await app.inject({ method: 'GET', url: `/api/domains/${domain2.id}` })).payload,
    );
    expect(d1.members.map((m: { group_id: string }) => m.group_id)).toContain(groupB.id);
    expect(d2.members.map((m: { group_id: string }) => m.group_id)).toContain(groupB.id);

    const listRes = await app.inject({ method: 'GET', url: `/api/domains?group_id=${groupB.id}` });
    const list = JSON.parse(listRes.payload);
    expect(list.length).toBe(2);
  });

  it('TC-D004-002: member group can leave a domain', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Leave Domain', groupA.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DOMLEV01', now + 3600, 5, domain.id],
    );
    await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMLEV01', group_id: groupB.id },
    });

    const leaveRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/leave`,
      payload: { group_id: groupB.id },
    });
    expect(leaveRes.statusCode).toBe(200);
    expect(JSON.parse(leaveRes.payload).success).toBe(true);

    // Group B no longer in members, and its domain list no longer shows the domain
    const getRes = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}` });
    const dom = JSON.parse(getRes.payload);
    const memberIds = dom.members.map((m: { group_id: string }) => m.group_id);
    expect(memberIds).not.toContain(groupB.id);

    const listRes = await app.inject({ method: 'GET', url: `/api/domains?group_id=${groupB.id}` });
    expect(JSON.parse(listRes.payload)).toEqual([]);
  });

  it('TC-D004-003: owner group cannot leave a domain', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Owner Domain', group.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/leave`,
      payload: { group_id: group.id },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('Domain owner cannot leave');
  });

  it('TC-D004-004: leave rejects non-member group', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Solo Domain', group.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/leave`,
      payload: { group_id: 'group-not-a-member' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('not a member of this domain');
  });
});

describe('IDSD-S1: Dissolve domain', () => {
  it('TC-D005-001: dissolving domain cleans up all member relations', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Doomed Domain', groupA.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DOMDEL01', now + 3600, 5, domain.id],
    );
    await app.inject({
      method: 'POST',
      url: '/api/domains/join',
      payload: { invite_code: 'DOMDEL01', group_id: groupB.id },
    });

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/domains/${domain.id}`,
    });
    expect(delRes.statusCode).toBe(200);
    expect(JSON.parse(delRes.payload).success).toBe(true);

    // No member rows remain
    const memberStmt = db.prepare('SELECT domain_id FROM domain_members WHERE domain_id = ?');
    memberStmt.bind([domain.id]);
    expect(memberStmt.step()).toBe(false);
    memberStmt.free();

    // Any group querying the domain gets 404
    const getRes = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}` });
    expect(getRes.statusCode).toBe(404);

    // Group B's domain list no longer contains the domain
    const listRes = await app.inject({ method: 'GET', url: `/api/domains?group_id=${groupB.id}` });
    expect(JSON.parse(listRes.payload)).toEqual([]);
  });

  it('TC-D005-002: dissolving unknown domain returns 404', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/domains/domain-does-not-exist',
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('Domain not found');
  });
});
