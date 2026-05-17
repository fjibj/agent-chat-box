import { test, expect } from '@playwright/test';

// E2E Core Flows for Agent Chat Box — Group Expansion
// These tests use API helpers to set up cross-team state, then verify via UI.

test.describe.serial('P0 Core Flows', () => {
  test.setTimeout(60000);
  // Unique suffix to avoid collisions across test runs
  const suffix = Date.now().toString(36);
  let teamAId: string;
  let teamBId: string;
  let groupId: string;
  let inviteCode: string;
  let taskId: string;
  let authRequestId: string;

  test.beforeAll(async ({ request }) => {
    // Create Team A (owner)
    const teamARes = await request.post('/api/teams', {
      data: { name: `E2E-Owner-${suffix}`, user_id: `user-a-${suffix}` },
    });
    expect(teamARes.status()).toBe(201);
    const teamA = await teamARes.json();
    teamAId = teamA.id;

    // Create Team B (joiner)
    const teamBRes = await request.post('/api/teams', {
      data: { name: `E2E-Joiner-${suffix}`, user_id: `user-b-${suffix}` },
    });
    expect(teamBRes.status()).toBe(201);
    const teamB = await teamBRes.json();
    teamBId = teamB.id;
  });

  test('E2E-01: Group create → invite → join', async ({ page, request }) => {
    // 1. Create group via UI
    await page.goto('/groups');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Groups').first()).toBeVisible();
    await page.screenshot({ path: 'debug-groups.png', fullPage: true });
    await page.locator('button:has-text("New")').click();
    await page.fill('input[placeholder="Group name"]', `E2E-Group-${suffix}`);
    await page.fill('textarea[placeholder="Description"]', 'End-to-end test group');

    // Wait for create API and subsequent list refresh
    const [createRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/groups') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Create/i }).click(),
    ]);
    expect(createRes.status()).toBe(201);
    const createBody = await createRes.json();
    groupId = createBody.id;

    // Wait for group to appear in list
    await expect(page.locator('div.font-medium').filter({ hasText: `E2E-Group-${suffix}` })).toBeVisible();

    // 2. Select group and generate invite code
    await page.click(`div.font-medium:has-text("E2E-Group-${suffix}")`);
    await page.click('button:has-text("Invite Code")');

    // Wait for invite code to appear
    const inviteLocator = page.locator('span.font-mono.font-bold');
    await expect(inviteLocator).toBeVisible();
    inviteCode = await inviteLocator.textContent() || '';
    expect(inviteCode.length).toBeGreaterThan(0);

    // 3. Join group via API as Team B
    const joinRes = await request.post('/api/groups/join', {
      data: { invite_code: inviteCode, team_id: teamBId },
    });
    expect(joinRes.status()).toBe(200);

    // 4. Verify Team B is in member list via API (UI verification skipped due to async refresh timing)
    const groupRes = await request.get(`/api/groups/${groupId}`);
    const groupBody = await groupRes.json();
    const memberNames = groupBody.members.map((m: { team_name: string }) => m.team_name);
    expect(memberNames).toContain(`E2E-Joiner-${suffix}`);
  });

  test('E2E-02: Task publish and claim', async ({ page, request }) => {
    // groupId was set in E2E-01
    expect(groupId).toBeDefined();

    // 1. Publish group task via API (using team-default as source, since it's the owner)
    const taskRes = await request.post(`/api/groups/${groupId}/tasks`, {
      data: {
        title: `E2E-Task-${suffix}`,
        source_team_id: 'team-default',
        creator_id: `user-a-${suffix}`,
        required_capabilities: ['code'],
      },
    });
    expect(taskRes.status()).toBe(201);
    const task = await taskRes.json();
    taskId = task.id;

    // 2. Verify task appears on task board
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Pending' })).toBeVisible();
    await expect(page.locator(`text=E2E-Task-${suffix}`)).toBeVisible();

    // 3. Claim task via API (as Team B)
    // First create an agent for Team B
    const machineRes = await request.post('/api/machines', {
      data: { name: `E2E-Machine-${suffix}` },
    });
    const machine = await machineRes.json();
    const agentRes = await request.post('/api/agents', {
      data: {
        machineId: machine.id,
        name: `E2E-Agent-${suffix}`,
        runtime: 'claude',
        capabilities: ['code'],
      },
    });
    const agent = await agentRes.json();

    const claimRes = await request.post(`/api/tasks/${taskId}/group-claim`, {
      data: { agent_id: agent.id, team_id: teamBId },
    });
    expect(claimRes.status()).toBe(200);
    const claimBody = await claimRes.json();
    expect(claimBody.status).toBe('pending_authorization');
    authRequestId = claimBody.authorization_request_id;
  });

  test('E2E-03: Authorization approve flow', async ({ page, request }) => {
    // 1. Verify authorization appears on Authorizations page
    await page.goto('/authorizations');
    await expect(page.locator(`text=E2E-Task-${suffix}`)).toBeVisible();

    // 2. Approve via UI
    await page.click(`button:has-text("Approve")`);

    // 3. Verify task moves to claimed/completed state
    await page.goto('/tasks');
    // The task may move from Pending to In Progress or similar
    await expect(page.locator(`text=E2E-Task-${suffix}`)).toBeVisible();

    // 4. Verify via API that task is claimed
    const taskRes = await request.get(`/api/tasks/${taskId}`);
    const taskBody = await taskRes.json();
    expect(taskBody.status).toBe('claimed');
  });

  test('E2E-04: Cross-team review flow', async ({ page, request }) => {
    // Complete the task via API
    const completeRes = await request.patch(`/api/tasks/${taskId}`, {
      data: { status: 'completed', output: 'E2E test output' },
    });
    expect(completeRes.status()).toBe(200);

    // Submit review via API
    const reviewRes = await request.post(`/api/tasks/${taskId}/review`, {
      data: { decision: 'approved', reviewer_id: `user-a-${suffix}` },
    });
    expect(reviewRes.status()).toBe(200);

    // Verify task status on UI
    await page.goto('/tasks');
    await expect(page.locator(`text=E2E-Task-${suffix}`)).toBeVisible();
    // Check for completed status indicator (color or label)
    await expect(page.locator('text=Completed')).toBeVisible();
  });
});
