# 联邦网关端到端手动联调指南

**Date:** 2026-05-16
**Scope:** Hub + Runner 星型拓扑完整链路验证
**Shell:** PowerShell (Windows)

---

## 联调目标

验证以下完整流程：

```
Team A (Hub) 创建群 -> 生成邀请码
        |
Team B (Runner) 反向连接 Hub -> 注册成功
        |
Team A 发布群任务（required_labels: ["python", "review"]）
        |
Team B 的 Runner poll 到任务 -> Agent claim -> 授权批准
        |
Team B 的 Agent 被唤醒 -> 开始执行
```

---

## 前置条件

- Node.js >= 20
- 项目依赖已安装：`npm install`
- 代码已编译通过（`npx tsc -p tsconfig.json --noEmit` 无联邦相关错误）

---

## 步骤 1：启动 Hub Server（Team A）

```powershell
# 终端 1 -- Hub Server（默认端口 3000）
cd D:\claudecode\MyAICodes\agent-chat-box
$env:DATA_DIR = "./data-hub"
$env:PORT = "3000"
npx tsx packages/server/src/index.ts
```

**预期输出：**
```
[server] HTTP listening on http://0.0.0.0:3000
[server] WebSocket endpoints: /ws, /daemon/connect, /federation
```

---

## 步骤 2：创建团队和群

在 **终端 2** 中执行（保持终端 1 的 Hub 运行）：

```powershell
cd D:\claudecode\MyAICodes\agent-chat-box

# 2.1 创建 Team A（群主）
$teamA = Invoke-RestMethod -Uri "http://localhost:3000/api/teams" -Method POST -ContentType "application/json" -Body '{"name":"Team-A-Hub","user_id":"user-a"}'
$TEAM_A_ID = $teamA.id
Write-Host "Team A ID: $TEAM_A_ID"

# 2.2 创建群
$group = Invoke-RestMethod -Uri "http://localhost:3000/api/groups" -Method POST -ContentType "application/json" -Body "{`"name`":`"Test-Group`",`"description`":`"Federation test`",`"owner_team_id`":`"$TEAM_A_ID`"}"
$GROUP_ID = $group.id
Write-Host "Group ID: $GROUP_ID"

# 2.3 生成邀请码
$invite = Invoke-RestMethod -Uri "http://localhost:3000/api/groups/$GROUP_ID/invite" -Method POST -ContentType "application/json" -Body '{"max_uses":10,"expires_in_hours":24}'
$INVITE_CODE = $invite.invite_code
Write-Host "Invite Code: $INVITE_CODE"

# 2.4 更新群 contract，添加 python 到 shared_capabilities
$contractBody = @{
    contract = @{
        shared_capabilities = @("code", "review", "test", "python")
        authorization = "manual"
        trust_threshold = 0.5
    }
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri "http://localhost:3000/api/groups/$GROUP_ID/contract" -Method PATCH -ContentType "application/json" -Body $contractBody
Write-Host "Group contract updated with python capability"
```

---

## 步骤 3：先启动 Runner Server（Team B，不启用联邦）

Runner 必须先启动起来，才能在上面创建 Team B 获取真实的 team_id。

```powershell
# 终端 3 -- Runner Server（端口 3001，先不启用联邦）
cd D:\claudecode\MyAICodes\agent-chat-box
$env:DATA_DIR = "./data-runner"
$env:PORT = "3001"
# 注意：暂时不设置 FEDERATION_URL，等创建好 Team B 后再启用联邦
npx tsx packages/server/src/index.ts
```

**预期输出：**
```
[server] HTTP listening on http://0.0.0.0:3001
```

---

## 步骤 3.5：在 Runner Server 上创建 Team B

在 **终端 2** 中执行：

```powershell
# 在 Runner Server（端口 3001）上创建 Team B
$teamB = Invoke-RestMethod -Uri "http://localhost:3001/api/teams" -Method POST -ContentType "application/json" -Body '{"name":"Team-B-Runner","user_id":"user-b"}'
$TEAM_B_ID = $teamB.id
Write-Host "Team B ID: $TEAM_B_ID"
```

**记录** `$TEAM_B_ID`，下一步重启 Runner 时填入 `FEDERATION_TEAM_ID`。

---

## 步骤 3.6：重启 Runner Server（启用联邦）

先关闭终端 3（Ctrl+C），然后重新启动：

```powershell
# 终端 3 -- 重启 Runner Server，启用联邦
$env:DATA_DIR = "./data-runner"
$env:PORT = "3001"
$env:FEDERATION_URL = "ws://localhost:3000/federation"
$env:FEDERATION_INVITE_CODE = "INVITE_CODE"    # <-- 替换为步骤 2.3 的邀请码
$env:FEDERATION_TEAM_ID = "$TEAM_B_ID"         # <-- 替换为步骤 3.5 的 Team B ID
npx tsx packages/server/src/index.ts
```

**预期输出（Runner 端）：**
```
[federation-runner] Connecting to Hub: ws://localhost:3000/federation
[federation-runner] Connected to Hub
[federation-runner] Registered with group: GROUP_ID
[federation-runner] Polled 0 tasks
```

**预期输出（Hub 端）：**
```
[federation-hub] New Runner connection
[federation-hub] Peer registered: team-b (group: GROUP_ID, total peers: 1)
```

---

## 步骤 4：发布群任务

在 **终端 2** 中执行：

```powershell
$body = @{
    title = "Review PR #42"
    source_team_id = $TEAM_A_ID
    creator_id = "user-a"
    required_capabilities = @("python", "review")
} | ConvertTo-Json -Compress

$task = Invoke-RestMethod -Uri "http://localhost:3000/api/groups/$GROUP_ID/tasks" -Method POST -ContentType "application/json" -Body $body
$TASK_ID = $task.id
Write-Host "Task ID: $TASK_ID"
```

**预期：**
- Hub 日志可能有 `[group-tasks] Failed to index group task in federation queue`（无错误，仅为 warn）
- `federation_task_index` 表中新增一条记录

---

## 步骤 5：观察 Runner Poll 到任务

在 **Runner 终端（终端 3）** 观察日志：

约 8 秒内应出现：
```
[federation-runner] Polled 1 tasks
```

---

## 步骤 6：注册带 Labels 的 Agent

在 **终端 2** 中执行：

```powershell
# 6.1 先注册 Machine（Runner 端，端口 3001）
$machine = Invoke-RestMethod -Uri "http://localhost:3001/api/machines" -Method POST -ContentType "application/json" -Body '{"name":"Runner-Machine"}'
$MACHINE_ID = $machine.id
Write-Host "Machine ID: $MACHINE_ID"

# 6.2 注册 Agent（带 labels）
$agentBody = @{
    machineId = $MACHINE_ID
    name = "CodeReviewer-B"
    runtime = "claude"
    capabilities = @("code_review")
    labels = @("python", "review", "linux")
} | ConvertTo-Json -Compress

$agent = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Method POST -ContentType "application/json" -Body $agentBody
$AGENT_ID = $agent.id
Write-Host "Agent ID: $AGENT_ID"
```

---

## 步骤 7：验证标签匹配过滤

### 7.1 正确匹配（labels 包含 python + review）

```powershell
$poll = Invoke-RestMethod -Uri "http://localhost:3000/api/federation/poll?team_id=$TEAM_B_ID&labels=python,review,linux"
Write-Host "Matched tasks: $($poll.tasks.Count)"
$poll.tasks | ForEach-Object { Write-Host "  - $($_.title)" }
```

**预期：**返回包含 `Review PR #42` 的任务列表。

### 7.2 错误匹配（labels 不包含 required）

```powershell
$poll = Invoke-RestMethod -Uri "http://localhost:3000/api/federation/poll?team_id=$TEAM_B_ID&labels=java,go"
Write-Host "Matched tasks: $($poll.tasks.Count)"
```

**预期：**返回空任务列表（`Matched tasks: 0`）。

---

## 步骤 8：Claim 任务 + 唤醒 Agent（可选）

```powershell
$claimBody = @{
    task_id = $TASK_ID
    agent_id = $AGENT_ID
    team_id = $TEAM_B_ID
} | ConvertTo-Json -Compress

$claim = Invoke-RestMethod -Uri "http://localhost:3000/api/federation/claim" -Method POST -ContentType "application/json" -Body $claimBody
Write-Host "Claim status: $($claim.status)"
```

**预期：**返回 `pending_authorization`。

如需完整唤醒流程，需通过 UI 或 API 批准授权（复用现有 authorization 流程）。

---

## 验证检查清单

| 步骤 | 验证点 | 通过标准 |
|------|--------|---------|
| 1 | Hub 启动 | HTTP 3000 + WSS `/federation` 就绪 |
| 2 | 创建群 + 邀请码 | API 返回 201 + invite_code |
| 3 | Runner 反向连接 | Runner 日志显示 "Registered with group" |
| 3 | Hub 收到注册 | Hub 日志显示 "Peer registered" |
| 4 | 发布群任务 | API 返回 201，DB 有 `federation_task_index` 记录 |
| 5 | Runner poll | 8 秒内 poll 到任务 |
| 7.1 | 标签匹配 | `python,review,linux` poll 返回任务 |
| 7.2 | 标签过滤 | `java,go` poll 返回空 |
| 8 | Claim | 返回 `pending_authorization` |

---

## 常见问题

### Q1: Runner 连接失败 "ECONNREFUSED"
- 检查 Hub Server 是否已启动在 3000 端口
- 检查 `FEDERATION_URL` 是否为 `ws://localhost:3000/federation`（不是 `wss`）

### Q2: 注册失败 "Invalid invite code"
- 邀请码过期：重新生成
- 大小写问题：invite_code 自动转大写，输入不区分大小写

### Q3: poll 返回空
- 检查 `team_id` 参数是否和注册时一致
- 检查 `labels` 参数是否包含 `required_capabilities` 的子集
- 检查任务是否已 claim 或完成

### Q4: 数据库冲突
- Hub 和 Runner 使用不同的 `DATA_DIR`（`data-hub` vs `data-runner`）

### Q5: JSON Body 报错 "Body is not valid JSON"
- PowerShell 字符串中不要用 `\"` 转义，改用 `ConvertTo-Json -Compress`
- 见步骤 4 和步骤 6 的示例

---

## 清理

```powershell
# 停止所有终端（Ctrl+C）
# 删除测试数据
Remove-Item -Recurse -Force data-hub, data-runner
```
