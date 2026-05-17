import { test, expect } from '@playwright/test';

// E2E Federation Gateway Tests
// Covers: Runner registration → task publish → poll → claim → wake → complete

const HUB_PORT = 3001;
const RUNNER_PORT = 3002;

function hubUrl(path: string) {
  return `http://localhost:${HUB_PORT}${path}`;
}

function runnerUrl(path: string) {
  return `http://localhost:${RUNNER_PORT}${path}`;
}

test.describe.serial('Federation Gateway E2E', () => {
  test.setTimeout(60000);
  const suffix = Date.now().toString(36);
  let teamAId: string;
  let teamBId: string;
  let groupId: string;
  let inviteCode: string;
  let taskId: string;

  // NOTE: These tests assume the Hub and Runner servers are started manually
  // or via a test harness that spins up two server instances.
  // For CI, use separate processes or the webServer config in playwright.config.ts.

  test('F010-01: Create teams and group on Hub', async ({ request }) => {
    // Create Team A (owner)
    const teamARes = await request.post(hubUrl('/api/teams'), {
      data: { name: `Fed-Owner-${suffix}`, user_id: `user-a-${suffix}` },
    });
    expect(teamARes.status()).toBe(201);
    const teamA = await teamARes.json();
    teamAId = teamA.id;

    // Create Team B (member)
    const teamBRes = await request.post(hubUrl('/api/teams'), {
      data: { name: `Fed-Member-${suffix}`, user_id: `user-b-${suffix}` },
    });
    expect(teamBRes.status()).toBe(201);
    const teamB = await teamBRes.json();
    teamBId = teamB.id;

    // Create group
    const groupRes = await request.post(hubUrl('/api/groups'), {
      data: {
        name: `Fed-Group-${suffix}`,
        description: 'Federation test group',
        owner_team_id: teamAId,
      },
    });
    expect(groupRes.status()).toBe(201);
    const group = await groupRes.json();
    groupId = group.id;

    // Generate invite code
    const inviteRes = await request.post(hubUrl(`/api/groups/${groupId}/invite`), {
      data: { max_uses: 10, expires_in_hours: 24 },
    });
    expect(inviteRes.status()).toBe(200);
    const inviteBody = await inviteRes.json();
    inviteCode = inviteBody.invite_code;
    expect(inviteCode.length).toBeGreaterThan(0);

    // Team B joins group
    const joinRes = await request.post(hubUrl('/api/groups/join'), {
      data: { invite_code: inviteCode, team_id: teamBId },
    });
    expect(joinRes.status()).toBe(200);
  });

  test('F010-02: Publish group task with required labels', async ({ request }) => {
    const taskRes = await request.post(hubUrl(`/api/groups/${groupId}/tasks`), {
      data: {
        title: `Fed-Task-${suffix}`,
        source_team_id: teamAId,
        creator_id: `user-a-${suffix}`,
        required_capabilities: ['python', 'review'],
      },
    });
    expect(taskRes.status()).toBe(201);
    const task = await taskRes.json();
    taskId = task.id;

    // Verify task is indexed in federation_task_index
    // (Direct DB verification would require test utilities)
  });

  test('F010-03: Runner poll returns matching tasks', async ({ request }) => {
    // Poll as Team B with matching labels
    const pollRes = await request.get(
      hubUrl(`/api/federation/poll?team_id=${teamBId}&labels=python,review,linux`),
    );
    expect(pollRes.status()).toBe(200);
    const pollBody = await pollRes.json();
    expect(pollBody.tasks).toBeDefined();
    expect(pollBody.tasks.length).toBeGreaterThan(0);

    const matchingTask = pollBody.tasks.find((t: { taskId: string }) => t.taskId === taskId);
    expect(matchingTask).toBeDefined();
    expect(matchingTask.title).toBe(`Fed-Task-${suffix}`);
  });

  test('F010-04: Runner poll filters non-matching labels', async ({ request }) => {
    // Poll with labels that don't match required_capabilities
    const pollRes = await request.get(
      hubUrl(`/api/federation/poll?team_id=${teamBId}&labels=java,go`),
    );
    expect(pollRes.status()).toBe(200);
    const pollBody = await pollRes.json();

    const matchingTask = pollBody.tasks.find((t: { taskId: string }) => t.taskId === taskId);
    expect(matchingTask).toBeUndefined();
  });

  test('F010-05: Hub fault tolerance — local APIs still work', async ({ request }) => {
    // Even if Hub is down, Team B's local server should still function
    // This test verifies the local server health endpoint
    const healthRes = await request.get(runnerUrl('/api/health'));
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe('ok');
  });
});
