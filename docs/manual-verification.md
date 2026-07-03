# Agent Chat Box 人工验证记录

**项目版本:** v0.2.0 follow-up（人工验证计划）
**验证日期:** 2026-05-02（v0.1.0 验证）/ 待执行（v0.2.0 验证）
**验证环境:** 两台 Windows 10 电脑，通过 Tailscale 组网

---

## 1. 验证环境

### 网络拓扑

```
┌─────────────────┐         Tailscale          ┌─────────────────┐
│   家里电脑      │ ◄═══════════════════════►  │   公司电脑      │
│  (home-pc)      │     100.112.136.37         │  (office-pc)    │
│  100.104.216.20 │       100.104.216.20       │                 │
└────────┬────────┘                            └─────────────────┘
         │
    运行中央服务器
    http://0.0.0.0:3000
    ws://0.0.0.0:3000/daemon/connect
```

### 设备信息

| 角色 | 设备名 | Tailscale IP | 系统 |
|------|--------|-------------|------|
| 服务器 + Agent | home-pc (sc-202203191806) | 100.112.136.37 | Windows 10 |
| Agent | office-pc (sc-202107030546) | 100.104.216.20 | Windows 10 |

### 软件版本

| 组件 | 版本 |
|------|------|
| Node.js | v24.13.1 |
| Tailscale | 1.96.3 |
| Agent Chat Box | 0.1.0 |

---

## 2. 自动化测试结果

### 测试统计

| 指标 | 结果 |
|------|------|
| 测试文件 | 8 |
| 测试用例 | 75 passed |
| typecheck | 通过 |
| build | 通过 |
| lint | 0 warnings, 0 errors |

### 测试覆盖

- **API 集成测试 (6 文件, 49 用例):** health, machines, agents, channels, messages, tasks
- **单元测试 (2 文件, 26 用例):** task-queue 核心逻辑, database CRUD

---

## 3. 人工验证清单

### 3.1 服务器启动

| # | 验证项 | 状态 | 备注 |
|---|--------|------|------|
| 1 | 服务器启动无报错 | [x] | 端口 3000 |
| 2 | /api/health 返回 ok | [x] | |
| 3 | /api/version 返回版本号 | [x] | v0.1.0 |
| 4 | SQLite 数据库自动创建 | [x] | data/chatbox.sqlite |
| 5 | 默认 #general 频道创建 | [x] | |

### 3.2 Machine 注册

| # | 验证项 | 状态 | 备注 |
|---|--------|------|------|
| 1 | POST /api/machines 注册 laptop | [x] | ab3388b3, API key sk_xxx... |
| 2 | POST /api/machines 注册 home-desktop | [x] | 8e57deee, API key sk_xxx... |
| 3 | POST /api/machines 注册 office-pc | [x] | d4d38fa0, API key sk_xxx... |
| 4 | GET /api/machines 列出三台机器 | [x] | |
| 5 | Machine status 更新为 online | [x] | daemon 认证后自动更新 |
| 6 | Machine status 更新为 offline | [x] | daemon 断开后自动更新 |

### 3.3 Agent 注册

| # | 验证项 | 状态 | 备注 |
|---|--------|------|------|
| 1 | Daemon 自动注册 laptop-claude | [x] | runtime: claude, status: awake |
| 2 | Daemon 自动注册 home-desktop-claude | [x] | runtime: claude, 复用已有 agent |
| 3 | GET /api/agents 列出三个 Agent | [x] | 1 awake + 2 sleeping |
| 4 | Agent status 更新为 awake | [x] | daemon 注册后自动更新 |
| 5 | 同 machine 同 runtime 不重复创建 | [x] | 匹配后更新 name + status |

### 3.4 Tailscale 组网

| # | 验证项 | 状态 | 备注 |
|---|--------|------|------|
| 1 | 两台设备 Tailscale 在线 | [x] | status 显示两个 peer |
| 2 | Tailscale IP 固定 | [x] | 重启不变 |
| 3 | 公司电脑 ping 通家里电脑 | [?] | 待远程机器验证 |
| 4 | 公司电脑访问 http://100.112.136.37:3000/api/health | [?] | 待远程机器验证 |
| 5 | 远程机器下载 daemon.cjs | [?] | curl http://100.112.136.37:3000/daemon.js |
| 6 | 远程 daemon 连接服务器 | [?] | node daemon.cjs --server ws://100.112.136.37:3000 ... |

### 3.5 Web UI

| # | 验证项 | 状态 | 备注 |
|---|--------|------|------|
| 1 | 浏览器打开 Web UI | [x] | http://localhost:3000 |
| 2 | 频道列表显示 #general | [x] | |
| 3 | 人类首次访问弹出名称设置 | [x] | NamePrompt 组件，存 localStorage |
| 4 | human.identify 后服务端记录名称 | [x] | ws/handler.ts Client.name |
| 5 | 聊天消息发送后实时显示 | [x] | broadcastToChannel 包含发送者 |
| 6 | 聊天历史显示发送者名称（非 UUID） | [x] | resolveSenderName + sender_name 持久化到 DB |
| 6b | 刷新后发送者名称保持（非 UUID） | [x] | sender_name 列 migration v2 |
| 6c | 刷新后自己的消息仍在右边 | [x] | 客户端 humanId 持久化到 localStorage |
| 7 | 成员列表显示名称 + 🤖/👤 图标 | [x] | REST API 解析 + 前端渲染 |
| 8 | Agent 消息蓝色边框 + BOT 标签 | [x] | MessageBubble 区分样式 |
| 9 | Human 消息绿色边框 + HUMAN 标签 | [x] | MessageBubble 区分样式 |
| 10 | @mention 自动补全下拉 | [x] | @触发，键盘导航选择 |
| 11 | 断开连接后成员自动清理 | [x] | DELETE channel_members |
| 12 | Agent 状态面板 | [?] | 待验证 |
| 13 | 任务看板 | [?] | 待验证 |

### 3.6 WebSocket 通信

| # | 验证项 | 状态 | 备注 |
|---|--------|------|------|
| 1 | 人类客户端自动认证 | [x] | 代码已修复 |
| 2 | 人类客户端自动加入 #general | [x] | 代码已修复 |
| 3 | Daemon 连接 + machine.auth | [x] | machine.welcome 返回，status 变 online |
| 4 | Daemon 注册 Agent (agent.hello) | [x] | agent.welcome 返回，status 变 awake |
| 5 | Daemon 加入频道 (channel.join) | [x] | channel.subscribed 返回 |
| 6 | 跨设备消息广播 | [?] | 待远程 daemon 连接后验证 |

### 3.7 任务流程

| # | 验证项 | 状态 | 备注 |
|---|--------|------|------|
| 1 | 创建任务 (POST /api/tasks) | [x] | 自动化测试通过 |
| 2 | 认领任务 (POST /api/tasks/:id/claim) | [x] | 自动化测试通过 |
| 3 | 更新任务状态 (PATCH /api/tasks/:id) | [x] | 自动化测试通过 |
| 4 | 任务超时检查 | [x] | 代码实现 |
| 5 | 子任务创建与父任务完成 | [x] | 自动化测试通过 |

---

## 4. 远程 Daemon 启动指南

### 4.1 前置条件

- 安装 Node.js >= 18
- 安装 Tailscale 并登录同一账号
- 服务器防火墙放行 TCP 3000 端口：
  ```powershell
  netsh advfirewall firewall add rule name="AgentChatBox" dir=in action=allow protocol=tcp localport=3000
  ```

### 4.2 下载 Daemon（只需一次）

```bash
curl -o daemon.cjs http://100.112.136.37:3000/daemon.js
```

### 4.3 启动命令

**前台运行（调试用，会占窗口）：**
```bash
# home-desktop
node daemon.cjs --server ws://100.112.136.37:3000 --token sk_ctUFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxM --name home-desktop

# office-pc
node daemon.cjs --server ws://100.112.136.37:3000 --token sk_HNRxZSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxKo --name office-pc

# laptop（本机）
node daemon.cjs --server ws://localhost:3000 --token sk_lUjO4PxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxfE --name laptop
```

**后台运行（推荐，不占窗口）：**

方式一：`&` 后台运行（Git Bash / Linux，最简单）
```bash
# home-desktop
node daemon.cjs --server ws://100.112.136.37:3000 --token sk_ctUFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxM --name home-desktop &

# 查看是否在跑
jobs -l

# 停止
kill %1
```

方式二：用 PM2（推荐长期运行，自动重启 + 日志管理）
```bash
# 安装 PM2（一次性）
npm i -g pm2

# home-desktop 后台启动
pm2 start daemon.cjs --name acb-daemon -- --server ws://100.112.136.37:3000 --token sk_ctUFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxM --name home-desktop

# office-pc 后台启动
pm2 start daemon.cjs --name acb-daemon -- --server ws://100.112.136.37:3000 --token sk_HNRxZSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxKo --name office-pc

# 查看日志
pm2 logs acb-daemon

# 开机自启（执行一次）
pm2 startup
pm2 save
```

方式二：用 Windows `start /min`（零依赖，最小化窗口运行）
```bat
@echo off
start /min "ACB-Daemon" node daemon.cjs --server ws://100.112.136.37:3000 --token sk_ctUFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxM --name home-desktop
```
保存为 `start-daemon.bat`，双击运行。窗口最小化到任务栏，关闭即停止。

### 4.4 CLI 参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--server <url>` | 否 | ws://localhost:3000 | 服务器 WebSocket 地址 |
| `--token <key>` | 是 | — | Machine API Key |
| `--name <name>` | 否 | unknown-machine | 机器名称 |
| `--help` | — | — | 显示帮助 |

环境变量 `SERVER_URL`、`MACHINE_TOKEN`、`MACHINE_NAME` 作为 fallback 兼容。

---

## 5. 测试中修复的 Bug

| # | 问题 | 严重度 | 修复文件 | 修复方式 |
|---|------|--------|----------|----------|
| 1 | Daemon 启动 OOM (Node.js v24 内存问题) | 高 | — | 用 `NODE_OPTIONS="--max-old-space-size=256"` 或用打包后的 daemon.cjs |
| 2 | Agent 不自动执行任务 | 中 | — | 设计如此 — MVP 阶段 daemon 只做消息路由 |
| 3 | 人类客户端无用户名系统 | 低 | — | MVP — 用 clientId 标识 |
| 4 | 无权限/认证系统 | 低 | — | MVP — 所有人类自动认证 |
| 5 | Machine 认证后 status 不更新为 online | 高 | ws/handler.ts | handleMachineAuth 中 UPDATE status='online'，close handler 中 UPDATE status='offline' |
| 6 | Machine 断开后 status 不更新为 offline | 高 | ws/handler.ts | ws.on('close') 中 UPDATE machines SET status='offline' |
| 7 | Daemon 收到 machine.welcome 后不触发 agent 注册 | 高 | daemon/connection.ts | machine.welcome 处理后增加 `this.options.onMessage?.(msg)` 转发 |
| 8 | 同机器重复注册 Agent（不同名称） | 中 | api/agents.ts | registerAgentWs 匹配条件改为 `machine_id AND (name OR runtime)` |
| 9 | Daemon 日志不显示 channel 加入成功 | 低 | daemon/index.ts | 增加 `channel.subscribed` case 处理 |
| 10 | 人类客户端无显示名系统 | 中 | shared/constants.ts, shared/types.ts, ws/handler.ts, web/App.tsx | 新增 human.identify / human.identified 协议，前端 NamePrompt 弹窗，服务端 Client.name 字段 |
| 11 | 聊天历史显示 UUID 不显示名称 | 中 | server/api/messages.ts | 加载历史消息时 resolveSenderName：agent 从 agents 表查名，human 从在线 clients 查名 |
| 12 | 发送消息后不实时显示（需刷新） | 高 | ws/handler.ts | broadcastToChannel 移除 excludeId 参数，发送者也收到 MSG_NEW 广播 |
| 13 | 成员列表显示 UUID 不显示名称 | 中 | server/api/channels.ts, web/MemberList.tsx | 新增 GET /api/channels/:id/members 端点，服务端解析名称返回 |
| 14 | Human/Agent 无视觉区分 | 低 | web/MessageBubble.tsx, web/MemberList.tsx | Agent 🤖蓝色边框+BOT标签，Human 👤绿色边框+HUMAN标签 |
| 15 | @mention 无自动补全 | 低 | web/MessageInput.tsx | @触发下拉菜单，键盘导航选择成员 |
| 16 | 断开后 human member 残留 | 中 | ws/handler.ts, server/index.ts | close 时 DELETE channel_members，启动时清理 stale human 和孤儿 agent |
| 17 | Bot @mentioned 无回复 | 低 | daemon/index.ts | message.new 检测 @agentName，自动回复 "收到！我是 xxx，有什么可以帮你的？" |
| 18 | 刷新后自己的消息跑到左边 (isOwn 失效) | 高 | web/useWebSocket.ts, web/App.tsx, server/ws/handler.ts | 客户端生成稳定 humanId 存 localStorage，human.identify 时发送 client_id，服务端更新 client.id 映射 |
| 19 | 刷新后发送者名称变回 UUID | 高 | server/db/schema.sql, server/db/index.ts, server/api/messages.ts, server/ws/handler.ts | messages 表新增 sender_name 列 (migration v1→v2)，saveMessage 写入 senderName，查询时从 DB 读取 |
| 20 | Daemon 反复重连死循环 | 高 | daemon/connection.ts | connect() 关旧 ws 触发 close→scheduleReconnect→新建连接→关旧→循环。修复：关旧前 clearTimeout + removeListener('close') |
| 21 | 同 machine key 多进程互踢 | 高 | — | 多个 daemon 进程用同一 API key，server 不断 close stale。根因：background 启动未去重。用独立 key + 单进程解决 |
| 22 | 无 channel member 删除端点 | 低 | server/api/channels.ts | 新增 DELETE /api/channels/:id/members/:memberId 端点 |
| 23 | 任务卡片/详情显示 UUID 不显示名称 | 中 | server/api/agents.ts, web/TaskBoard.tsx, TaskCard.tsx, TaskDetailModal.tsx | 新增 GET /api/resolve-names 端点，前端合并 agent + human 名称映射 |
| 24 | DB CHECK 约束缺少 'assign' 模式 | 高 | server/db/schema.sql, server/db/index.ts | schema 更新 + migration v2→v3 重建 tasks 表 |
| 25 | Claude CLI 任务执行报错 "unknown option '--prompt'" | 高 | daemon/agent-driver/claude-code.ts | 改用 `-p` 标志（位置参数） |
| 26 | Claude CLI 输出 help text 不执行任务 | 高 | daemon/agent-driver/claude-code.ts | start() 的 spawn 参数与 chat() 不一致，统一为 `['ignore','pipe','pipe']` + 简单 prompt |
| 27 | Claude CLI 执行 OOM (Node.js v24) | 高 | daemon/agent-driver/claude-code.ts | 设置 NODE_OPTIONS=--max-old-space-size=1024 |
| 28 | Daemon handler 未处理 task.running/task.updated | 低 | daemon/index.ts | 添加 case 消除 "Unhandled" 日志 |
| 29 | 竞争模式本地 agent 总是赢 | 中 | daemon/index.ts | claimAndExecute 添加 0~3s 随机延迟 |
| 30 | API Key 未保存 | 低 | docs/api-keys.md, .gitignore | 保存到独立文件，加入 gitignore |
| 31 | 同 machine 新旧连接竞态导致 daemon 重连死循环 | 高 | server/ws/handler.ts | close handler 检查是否还有同 machineId 的活跃连接，有则不标 offline |
| 32 | 任务超时后子任务卡住无法继续 | 中 | — | 手动通过 PATCH API 重置根任务为 running + 子任务为 pending |
| 33 | Claude CLI 子进程 OOM (NODE_OPTIONS 过大) | 中 | daemon/agent-driver/claude-code.ts | --max-old-space-size 从 1024 降为 512 |

---

## 6. 任务系统 UI 验证

**验证环境:** http://localhost:5173 (Web UI) + http://localhost:3000 (Server)

### 6.1 创建任务

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 点击顶部导航 "Tasks" | 进入任务看板页面，显示三列：Pending / In Progress / Completed | [ ] |
| 2 | 点击 "+ New Task" 按钮 | 弹出创建任务模态框，包含 Channel/Title/Description/Priority/Mode/Tags 字段 | [ ] |
| 3 | 选择频道 #general，填写 Title "测试任务1"，Priority 选 High | 表单正常填写，无报错 | [ ] |
| 4 | 点击 "Create Task" | 模态框关闭，任务出现在 Pending 列，显示 High 优先级标签 | [ ] |
| 5 | 创建第二个任务 "测试任务2"，Mode 选 Collaborate | 任务出现在 Pending 列，显示 collaborate 标签 | [ ] |

### 6.2 查看任务详情

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 点击 "测试任务1" 卡片 | 弹出详情模态框，显示完整信息：标题、优先级、状态、模式、创建时间 | [ ] |
| 2 | 确认详情中有 Claim 按钮和 Agent 选择下拉框 | Agent 列表显示已注册的 Agent | [ ] |
| 3 | 确认 Timeline 区域显示 task.created 事件 | 时间线包含创建记录 | [ ] |

### 6.3 认领任务

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 在详情中选择一个 Agent | 下拉框显示 Agent 名称和状态 | [ ] |
| 2 | 点击 "Claim" 按钮 | 状态变为 claimed，Claim 按钮消失，出现 Start/Complete/Fail 按钮 | [ ] |
| 3 | 关闭详情，查看看板 | 任务从 Pending 列移到 In Progress 列，显示蓝色 claimed 标签 | [ ] |
| 4 | 回到详情，Timeline 新增 task.claimed 事件 | 时间线包含 claimed 记录和 assignee 信息 | [ ] |

### 6.4 执行任务

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 在详情中点击 "Start" | 状态变为 running | [ ] |
| 2 | 查看看板 | 任务仍在 In Progress 列，显示 running 标签 | [ ] |

### 6.5 完成任务

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 在详情中 Output 输入 "任务完成，耗时 5 分钟" | 输入框正常显示 | [ ] |
| 2 | 点击 "Complete" | 状态变为 completed，详情显示 Output 内容和 completedAt 时间 | [ ] |
| 3 | 关闭详情，查看看板 | 任务从 In Progress 列移到 Completed 列，显示绿色 Done 标签 | [ ] |
| 4 | 查看 Timeline | 包含 task.created → task.claimed → task.completed 完整事件链 | [ ] |

### 6.6 任务失败

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 对 "测试任务2" 执行 Claim → 点击 "Fail" | 状态变为 failed | [ ] |
| 2 | 查看看板 | 任务在 Completed 列，显示红色 Failed 标签 | [ ] |

### 6.7 搜索和刷新

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 搜索框输入 "测试任务1" | 只显示匹配的任务，另一个隐藏 | [ ] |
| 2 | 清空搜索框 | 恢复显示所有任务 | [ ] |
| 3 | 点击 "Refresh" 按钮 | 重新加载任务列表，数据与服务端同步 | [ ] |

### 6.8 数据持久化

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 刷新页面 (F5) | 任务数据保持，状态不变 | [ ] |
| 2 | 重新进入 Tasks 页面 | 看板正确显示所有任务及其状态 | [ ] |

---

## 7. 真实任务执行验证

**前置条件:** 按 4.2/4.3 启动 daemon（同一个 daemon 同时支持聊天和任务执行）

### 7.1 竞争模式（Compete）— 自动争抢 + 真实执行

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | Web UI 点击 "+ New Task" | 弹出创建模态框 | [x] |
| 2 | 填写 Title "测试竞争任务"，Mode 选 **Compete (auto)** | 表单正常 | [x] |
| 3 | 点击 "Create Task" | 任务出现在 Pending 列 | [x] |
| 4 | 等待几秒 | daemon 自动 claim 任务，状态变为 claimed → running | [x] |
| 5 | 查看看板 | 任务移到 In Progress 列，显示 running 标签 | [x] |
| 6 | 等待 Claude Code 执行完成 | 状态变为 completed，output 包含执行结果 | [x] |
| 7 | 查看看板 | 任务移到 Completed 列，显示 Done 标签 | [x] |
| 8 | 点击任务查看详情 → Timeline | 包含 task.created → task.claimed → task.completed 完整链 | [x] |

**验证结果 (2026-05-04):** 两台远程机器 (home-desktop, office-pc) 竞争模式验证通过。随机延迟 0~3s 保证公平性，home-desktop-claude 抢到任务并真实执行 Claude Code 返回结果。

### 7.2 指派模式（Assign）— 指定 Agent 执行

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 点击 "+ New Task" | 弹出创建模态框 | [x] |
| 2 | 填写 Title "测试指派任务"，Mode 选 **Assign** | 出现 "Assign to Agent" 下拉框 | [x] |
| 3 | 选择目标 Agent | 下拉框显示 agent 名称和状态 | [x] |
| 4 | 点击 "Create Task" | 任务直接出现在 In Progress 列（status=claimed） | [x] |
| 5 | 等待几秒 | daemon 检测到指派给自己，自动开始执行 | [x] |
| 6 | 等待执行完成 | 状态变为 completed | [x] |

**验证结果 (2026-05-04):** 指派给 office-pc-claude，任务直接 status=claimed，daemon 自动执行 Claude Code，返回远程机器磁盘信息。

### 7.3 管理员手动 Override

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 创建一个 Compete 任务，等 daemon 自动 claim | 任务在 In Progress 列 running | [ ] |
| 2 | 点击任务打开详情，点击 "Fail" | 状态变为 failed，daemon 的执行进程被忽略 | [ ] |
| 3 | 创建一个 Assign 任务，指派给离线 agent | 任务在 Pending 列（agent 离线不会自动执行） | [ ] |
| 4 | 在详情中手动选择另一个 agent 点击 "Claim" | 任务被手动 claim 给在线 agent | [ ] |

### 7.4 多 Agent 竞争（需多台机器）

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 启动两台机器的 daemon | 两个 agent 在线 | [x] |
| 2 | 创建 Compete 任务 | 两个 agent 同时收到 task.created | [x] |
| 3 | 观察哪个 agent 先 claim | 先到的 agent 获得任务，另一个收到 ALREADY_CLAIMED | [x] |
| 4 | 等待执行完成 | 任务正常 completed | [x] |

**验证结果 (2026-05-04):** home-desktop + office-pc 两台远程机器同时竞争，home-desktop-claude 抢到任务并完成（报告系统运行时间 7天2小时13分钟）。

---

## 8. 协作模式 (Collaborate) 验证

**设计规格:**
- 最大嵌套深度: 3 层 (根=0, 子=1, 孙=2)
- 单次最大子任务数: 5
- 失败重试上限: 3
- 新增状态: `decomposing`, `verifying`
- 人工干预: force complete / force fail (任意层级)

### 8.1 基础协作流程

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 创建 collaborate 任务 "分析项目结构" | 任务出现在 Pending 列 | [ ] |
| 2 | 等待 agent claim | 状态变为 claimed → decomposing | [ ] |
| 3 | Agent 执行拆分 prompt | 自动生成子任务（≤5个），状态变为 decomposing | [ ] |
| 4 | 子任务自动 compete/assign 执行 | 子任务独立执行，状态 pending → claimed → running → completed | [ ] |
| 5 | 所有子任务完成 | 父任务进入 verifying 状态 | [ ] |
| 6 | Agent 执行验证 prompt | 验证通过 → 父任务 completed | [ ] |
| 7 | 查看 Timeline | 包含 task.created → claimed → decomposing → verifying → completed 完整链 | [ ] |

### 8.2 子任务失败重试

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 创建 collaborate 任务，其中一个子任务失败 | 失败子任务自动重试（最多3次） | [ ] |
| 2 | 重试成功 | 父任务正常 completed | [ ] |
| 3 | 重试3次仍失败 | 父任务标记 failed | [ ] |

### 8.3 人工 Force Override

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 子任务执行中，点击 "Force Complete" | 子任务强制完成，父任务继续验证流程 | [ ] |
| 2 | 子任务执行中，点击 "Force Fail" | 子任务强制失败，触发重试 | [ ] |
| 3 | 父任务 verifying 时，点击 "Force Complete" | 父任务直接 completed | [ ] |
| 4 | 父任务任意状态，点击 "Force Fail" | 父任务直接 failed | [ ] |

### 8.4 任务树 UI

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 点击协作任务卡片 | 详情弹窗显示子任务树（可折叠） | [ ] |
| 2 | 子任务状态图标 | completed=绿✅, running=蓝🔄, failed=红❌, pending=灰⏳ | [ ] |
| 3 | 主任务卡片显示进度 | 显示 "2/5 completed" 进度 | [ ] |
| 4 | 点击子任务 | 可查看子任务详情 | [ ] |
| 5 | 子任务详情有返回按钮 | 可跳回父任务 | [ ] |

### 8.5 三层嵌套

| # | 操作 | 预期结果 | 状态 |
|---|------|----------|------|
| 1 | 根任务拆出子任务，子任务再拆孙任务 | 最多3层，孙任务不可再拆 | [ ] |
| 2 | 孙任务全部完成 | 子任务进入 verifying → completed | [ ] |
| 3 | 所有子任务完成 | 根任务进入 verifying → completed | [ ] |

---

## 9. 下一步验证计划（更新）

1. ~~**远程 Daemon 重新配置**~~ — 已完成，三台机器独立 API key
2. ~~**竞争模式验证**~~ — 已完成，两台远程机器争抢成功
3. ~~**指派模式验证**~~ — 已完成，office-pc 指派执行成功
4. **跨设备聊天测试** — 三台设备互发消息，验证实时显示、名称解析、@mention 回复
5. **Agent 间对话** — 测试 agent @mention 链式回复（A 回复 @B → B 自动接话）
6. **协作模式验证** — 创建主任务 → 分解子任务 → 多 agent 并行执行 → 主任务自动完成
7. **NPM 发布** — `npx @agent-chat-box/daemon@latest` 一键启动

---

## 9. 验证时间线

| 时间 | 操作 | 结果 |
|------|------|------|
| 2026-05-02 09:43 | 自动化测试 (75 用例) | 全部通过 |
| 2026-05-02 10:30 | 修复 lint warnings (22→0) | 通过 |
| 2026-05-02 10:55 | 安装 Tailscale | v1.96.3 |
| 2026-05-02 11:00 | Tailscale 登录 + 组网 | 两个 peer 在线 |
| 2026-05-02 11:10 | 服务器启动 | 端口 3000 正常 |
| 2026-05-02 11:15 | 注册 Machine + Agent | 2 machine + 2 agent |
| 2026-05-02 11:20 | Daemon OOM | Node.js v24 内存问题 |
| 2026-05-02 12:00 | 修复 machine.welcome 不转发 bug | daemon agent 注册成功 |
| 2026-05-02 12:10 | 修复 machine status 不更新 bug | online/offline 状态正常 |
| 2026-05-02 12:20 | 修复重复 Agent 注册 bug | 同 machine 同 runtime 复用 |
| 2026-05-02 12:30 | Daemon 打包为单文件 (daemon.cjs, 140KB) | `node daemon.cjs --help` 正常 |
| 2026-05-02 12:35 | 服务器托管 daemon.js 端点 | curl http://localhost:3000/daemon.js 可下载 |
| 2026-05-02 12:40 | 3 个 Machine + 3 个 Agent 注册完成 | laptop online, 其余 offline（daemon 未启动） |
| 2026-05-02 13:00 | 修复聊天历史显示 UUID | messages.ts 增加 resolveSenderName |
| 2026-05-02 13:10 | 修复发消息后不实时显示 | broadcastToChannel 移除 sender 排除 |
| 2026-05-02 13:20 | 成员列表名称解析 + 视觉区分 | REST API + 前端图标/颜色区分 |
| 2026-05-02 13:30 | @mention 自动补全 | MessageInput 下拉菜单 + 键盘导航 |
| 2026-05-02 13:40 | 人类显示名系统 | human.identify 协议 + NamePrompt 弹窗 |
| 2026-05-02 13:50 | 残留成员清理 | disconnect cleanup + startup cleanup |
| 2026-05-02 14:00 | Bot @mention 自动回复 | daemon message.new 检测 mentions 并回复 |
| 2026-05-02 15:00 | 修复刷新后 isOwn 失效 | 客户端 humanId 持久化 + 服务端 ID 映射 |
| 2026-05-02 15:10 | 修复刷新后 senderName 变 UUID | DB migration v2 + sender_name 持久化 |
| 2026-05-02 16:00 | 修复 daemon 重连死循环 | connection.ts 关旧前清除 reconnect timer + close listener |
| 2026-05-02 16:10 | 修复同 key 多进程互踢 | 独立 API key + 确保单进程 |
| 2026-05-02 16:20 | 新增 channel member 删除端点 | DELETE /api/channels/:id/members/:memberId |
| 2026-05-02 16:30 | 本机 daemon (laptop-claude) 验证通过 | 连接稳定，@mention 回复正常 |
| 2026-05-03 10:00 | 任务卡片/详情名称解析 | 新增 resolve-names API，前端显示 agent/human 名称 |
| 2026-05-03 11:00 | 添加 assign 模式到 DB schema | migration v2→v3，CHECK 约束包含 compete/assign/collaborate |
| 2026-05-03 12:00 | 修复 Claude CLI 参数错误 | --prompt → -p，统一 start() 与 chat() spawn 模式 |
| 2026-05-03 13:00 | 修复 Claude CLI OOM | NODE_OPTIONS=--max-old-space-size=1024 |
| 2026-05-03 14:00 | 添加竞争随机延迟 | claimAndExecute 0~3s 延迟保证公平性 |
| 2026-05-04 10:00 | 竞争模式验证通过 | home-desktop + office-pc 两台远程机器争抢成功 |
| 2026-05-04 10:10 | 指派模式验证通过 | office-pc-claude 指派执行，返回远程磁盘信息 |
| 2026-05-04 10:20 | 多 Agent 竞争验证通过 | home-desktop 抢到任务，完成时间 7天2小时 |
| 2026-05-04 15:00 | 修复 server 新旧连接竞态 bug | close handler 检查同 machine 活跃连接，daemon 不再死循环重连 |
| 2026-05-04 15:10 | 清理残留 daemon 进程 | 多次启动导致同 key 多进程互踢，清理后单实例稳定 |
| 2026-05-04 15:20 | 协作模式任务超时处理 | 根任务超时标 failed，子任务卡住。手动重置根任务 + 子任务状态 |
| 2026-05-04 15:30 | 修复 Claude CLI 子进程 OOM | NODE_OPTIONS --max-old-space-size 从 1024 降为 512 |

---


# 附录：v0.2.0 群扩展 & 联邦网关人工验证计划

**项目版本:** v0.2.0 + follow-up stories（G027~G031、F011~F012、Q001）
**计划创建日期:** 2026-06-20
**调整日期:** 2026-07-03
**Verifier:** _____________
**验证状态:** ⬜ 未开始 / 🔄 进行中 / ✅ 全部通过 / ❌ 阻塞

---

## A. 验证目标与范围

### A.1 目标
- 验证 v0.2.0 群级扩展 (Stories G001~G026) 与联邦网关 (Stories F001~F010) 在 Web UI 上的端到端可用性
- 验证 v0.2.0 follow-up stories（G027~G031、F011~F012）对人工验证阶段发现的 14 个 GAP 的修复效果
- 校核自动化测试（根 76 + server 236 + web 25 = 337 用例）已覆盖的逻辑是否在真实交互中表现一致
- 暴露剩余 UI 缺口与已知限制（用于发版说明 / 下一迭代输入）

### A.2 范围
本计划聚焦 **Web 界面 + 后端联动**，按页面与功能纵向拆分。
联邦底层协议（Runner 反向 WSS、心跳、poll、自动重连、出入群广播等）已在 `docs/federation-e2e-manual-test-guide.md` 中验证，本计划只校核 UI 触发的相关链路。

### A.3 不在本次范围
- 性能压力测试
- 安全渗透测试
- NPM 发布与 Daemon 升级
- v0.1.0 已在 §1~§9 验证过的功能（除非 v0.2.0 改动了相关代码）

---

## B. 已知 UI 限制（验证前请阅）

以下限制在 v0.2.0 follow-up 中**已部分解决**。表中用 ✅ 表示已可通过 UI 验证，⬜ 表示仍需通过 API/SQL 补齐：

| 编号 | 限制描述 | 状态 | 影响验证项 | 操作方式 |
|------|----------|------|------------|----------|
| L-01 | Add Agent 模态框缺少 `labels` 输入字段 | ✅ 已修复 | M3 联邦标签匹配 | 直接在 UI 输入 labels |
| L-02 | GroupsPage 没有 "Leave Group" 按钮 | ✅ 已修复 | M2 退群流程 | 在群详情点击 Leave Group |
| L-03 | GroupsPage 没有 "Delete Group" 按钮 | ✅ 已修复 | M2 解散群 | 在群详情点击 Delete Group |
| L-04 | `ReputationBadge` 组件未在任何页面渲染 | ✅ 已修复 | M5/M6 信誉分展示 | 在 Groups/Authorizations 页面直接查看 |
| L-05 | 没有 Reviews UI 页面 | ✅ 已修复 | M7 Review 工作流 | 在 TaskDetailModal 的 Review 区域操作 |
| L-06 | 没有 Group Tasks 专属页面（群任务混在 Tasks 看板中） | ⬜ 仍缺失 | M4 群任务发布 | 通过 `POST /api/groups/:gid/tasks` 发布 |
| L-07 | Settings 页面 `version` 硬编码 `0.1.0` | ✅ 已修复 | A.1 环境检查 | `/api/server-info` 动态读取根 `package.json` 版本 |
| L-08 | 没有 Federation Peers 状态面板 | ✅ 已修复 | M7 联邦连接观测 | 在 Settings 页面 Federation Peers 区域查看 |
| L-09 | Authorizations 页面只展示当前 `team-default` 团队作为审批方 | ⬜ 仍受限 | M5 跨团队场景 | 默认 `team_id` 写死为 `team-default`，多团队场景需改 hardcode 或 API 直调 |
| L-10 | Authorizations 页面 "Team:" 只显示 `team_id.slice(0,8)` | ⬜ 仍受限 | M5 团队识别 | 通过 `GET /api/teams/:id` 验证完整团队信息 |

**约定：**
- ✅ = 验证通过、行为符合预期
- ❌ = 不通过、需修复或记录已知问题
- ⏭️ = 跳过（受限于已知限制 L-XX）

---

## C. 验证前准备

### C.1 环境检查清单

| # | 检查项 | 命令 / 操作 | 状态 |
|---|--------|-------------|------|
| C-01 | 当前在 main 分支且工作树干净（除已知未提交文件） | `git status` | [ ] |
| C-02 | 依赖已安装 | `npm install` | [ ] |
| C-03 | 自动化测试全部通过（根 76 + server 236 + web 25 = 337 用例） | `npm test` + server/web vitest | [ ] |
| C-04 | typecheck 通过 | `npm run typecheck` | [ ] |
| C-05 | 服务器启动无报错 | `npm run dev:server` | [ ] |
| C-06 | Web UI 启动无报错 | `npm run dev:web` | [ ] |
| C-07 | `/api/health` 返回 `{ status: 'ok' }` | `curl http://localhost:3000/api/health` | [ ] |
| C-08 | 浏览器访问 `http://localhost:5173`（dev）或 `http://localhost:3000`（生产构建） | 打开 DevTools → Network/Console | [ ] |
| C-09 | DevTools Console 无报错（除已知 React DevTools 提示） | F12 查看 | [ ] |
| C-10 | 默认团队 `team-default` 已存在 | `curl http://localhost:3000/api/teams?user_id=user-default` | [ ] |
| C-11 | BMAD/TEA 质量门禁通过 | `npm run quality:gates` | [ ] |

### C.2 测试数据准备

需要预置 **2 个团队 + 1 个群 + 4 个 Agent**。建议用 `curl` 或 Postman 一次性建好：

```bash
# 1. 创建 Team B（成员团队）
curl -X POST http://localhost:3000/api/teams \
  -H 'Content-Type: application/json' \
  -d '{"name":"Team-B","user_id":"user-b"}'
# → 记下返回的 team_id，记为 TEAM_B_ID

# 2. 在 Team A (team-default) 与 Team B 各注册 1 台机器
curl -X POST http://localhost:3000/api/machines \
  -H 'Content-Type: application/json' \
  -d '{"name":"machine-a1"}'
# → 记下 apiKey，启动 daemon

curl -X POST http://localhost:3000/api/machines \
  -H 'Content-Type: application/json' \
  -d '{"name":"machine-b1"}'

# 3. 启动两个 daemon 进程（用各自的 apiKey），观察 /api/machines 状态变 online
# 4. 通过 daemon 自动注册或 POST /api/agents 手工建 Agent，至少各 1 个
# 5. 给 agent-a1 加 labels=["python","review"]，给 agent-b1 加 labels=["python"]
#    方式一：在 Agents 页面 Add Agent 时直接填写 Labels
#    方式二：SQL 直接更新
sqlite3 data/agent-chat-box.sqlite \
  "UPDATE agents SET labels='[\"python\",\"review\"]' WHERE name='agent-a1';"
```

| # | 准备项 | 状态 | 备注 |
|---|--------|------|------|
| D-01 | Team A (team-default) 存在并是 owner | [ ] | seed 数据自带 |
| D-02 | Team B 创建成功，记录 TEAM_B_ID | [ ] | TEAM_B_ID = ____________ |
| D-03 | Machine A1 在线（status=online） | [ ] | |
| D-04 | Machine B1 在线（status=online） | [ ] | |
| D-05 | Agent A1（runtime=claude，labels=`["python","review"]`） | [ ] | AGENT_A1_ID = ____________ |
| D-06 | Agent B1（runtime=claude，labels=`["python"]`） | [ ] | AGENT_B1_ID = ____________ |
| D-07 | Agent A2（runtime=codex，labels=`[]`，用于"无能力 agent"对照组） | [ ] | AGENT_A2_ID = ____________ |
| D-08 | DevTools Network 标签已开启，便于观察 API 请求 | [ ] | |

---

## D. 模块一：导航栏与路由 (M1)

验证顶部导航的 6 个菜单项渲染、路由切换、各页面挂载时数据加载是否成功。

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M1-01 | 浏览器打开 Web UI 根路径 | 页面加载，默认进入 Chat 页面（地址栏显示 `/`） | [ ] | `App.tsx:194` `Route path="/"` |
| M1-02 | 观察顶部导航栏 | 显示 6 个链接：Chat、Tasks、Groups、Authorizations、Agents、Settings；当前激活项有蓝灰色背景 | [ ] | `App.tsx:182-188` NavLink 组件 |
| M1-03 | 点击 "Chat"  | 路由 `/`，左侧 ChannelList、中间消息列表、右侧 MemberList | [ ] | `ChatPage` |
| M1-04 | 点击 "Tasks" | 路由 `/tasks`，看板 3 列：Pending / In Progress / Completed | [ ] | `TaskBoard.tsx:147` |
| M1-05 | 点击 "Groups" | 路由 `/groups`，左侧群列表（含 + New 按钮、Invite Code 输入框、Join 按钮），右侧空提示 "Select a group to view details" | [ ] | `GroupsPage.tsx:114` |
| M1-06 | 点击 "Authorizations" | 路由 `/authorizations`，标题 "Authorization Requests"，下方 "No pending authorization requests" 或卡片列表 | [ ] | `AuthorizationsPage.tsx:60` |
| M1-07 | 点击 "Agents" | 路由 `/agents`，"Machines & Agents" 标题 + "+ Add Agent" 按钮，下方按机器分组的 Agent 列表 | [ ] | `AgentsPage.tsx:84` |
| M1-08 | 点击 "Settings" | 路由 `/settings`，显示 Server Info / Connection / API Keys 三个分组 | [ ] | `SettingsPage.tsx:84` |
| M1-09 | DevTools Network 观察 Groups 页面加载 | 触发 `GET /api/groups?team_id=team-default`，返回 200 | [ ] | `GroupsPage.tsx:36-42` |
| M1-10 | DevTools Network 观察 Authorizations 页面加载 | 触发 `GET /api/authorizations/pending?team_id=team-default`，返回 200 | [ ] | `AuthorizationsPage.tsx:20-25` |
| M1-11 | DevTools Network 观察 Agents 页面加载 | 同时触发 `GET /api/machines` + `GET /api/agents`，均返回 200 | [ ] | `AgentsPage.tsx:25-32` |
| M1-12 | 顶部连接状态指示灯 | 绿色（已连接 WebSocket） | [ ] | `App.tsx:177` |
| M1-13 | 用户名右上角显示 | 显示登录时输入的姓名而非 UUID | [ ] | `App.tsx:180` |
| M1-14 | 浏览器 F5 刷新当前页面 | 路由保持，不会跳回 `/`（React Router 客户端路由生效） | [ ] | `App.tsx:194` BrowserRouter |
| M1-15 | URL 直接输入 `/groups` 回车 | 直接进入 Groups 页面，不会 404 | [ ] | `index.ts:205` SPA fallback |

---

## E. 模块二：Groups 页面 — 群生命周期 (M2)

### M2.1 群列表与创建

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M2-01 | 进入 Groups 页面，无任何群时观察左侧 | 显示空白列表，"+ New" 按钮可见，Invite Code 输入框 + Join 按钮可见 | [ ] | `GroupsPage.tsx:117-132` |
| M2-02 | 点击 "+ New" | 右侧出现创建表单：Name 输入框（focus）、Description 多行文本框、Create / Cancel 按钮 | [ ] | `GroupsPage.tsx:151-170` |
| M2-03 | Name 留空，点击 "Create" | 按钮无响应（前端 `if (!newGroupName.trim()) return;`），不发请求 | [ ] | `GroupsPage.tsx:55-56` |
| M2-04 | 填 Name="UI-Test-Group"，Description="manual verification"，点 Create | Network 触发 `POST /api/groups` body 含 `name`, `description`, `owner_team_id="team-default"`，返回 201 | [ ] | `GroupsPage.tsx:55-73`，`groups.ts:26-77` |
| M2-05 | 创建成功后界面变化 | 表单关闭，左侧列表新增 "UI-Test-Group" 条目，显示 "0 members" | [ ] | `GroupsPage.tsx:66-71` |
| M2-06 | 点击列表中的 "UI-Test-Group" | 右侧显示群详情：标题 + 描述 + Invite Code 按钮 + Members（owner=team-default） + Contract 编辑器 | [ ] | `GroupsPage.tsx:171-265` |
| M2-07 | 后端验证默认契约 | DevTools 观察 `GET /api/groups/:id/contract`，返回 `authorization=manual`, `trust_threshold=0.5`, `shared_capabilities=[code,review,test]` | [ ] | `groups.ts:7-21` `DEFAULT_CONTRACT_YAML` |
| M2-08 | 创建第二个群 "Team-Collab-Group"，描述任意 | 列表出现两条目，可切换 | [ ] | |
| M2-09 | 取消按钮：点 "+ New" → 填一半 → 点 "Cancel" | 表单关闭，Name 字段清空，左侧列表无新增 | [ ] | `GroupsPage.tsx:168` |
| M2-10 | 创建群时网络断开（DevTools Offline） | 错误提示横幅显示 "Failed to create group" | [ ] | `GroupsPage.tsx:72` `setError` |

### M2.2 邀请码生成与有效期

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M2-11 | 选中 "UI-Test-Group"，点击 "Invite Code" | 触发 `POST /api/groups/:id/invite`，返回 8 位大写字母数字（如 `A3F5B2C1`） | [ ] | `groups.ts:274-311` |
| M2-12 | 邀请码显示位置 | 标题下方紫色提示框，字体等宽，包含完整邀请码 | [ ] | `GroupsPage.tsx:188-192` |
| M2-13 | 再次点击 "Invite Code" | 生成新邀请码，旧码失效（DB 字段被覆盖） | [ ] | `groups.ts:296-300` UPDATE 语句 |
| M2-14 | 验证默认有效期 24 小时 | 后端响应 `expires_at` ≈ now + 86400 秒 | [ ] | `groups.ts:292` `expiresInHours = 24` |
| M2-15 | 邀请码 max_uses 默认无限 | 后端响应 `max_uses=null` | [ ] | `groups.ts:291` |

### M2.3 加入群

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M2-16 | **前置：** 先用 API 把 `currentUser` 切到 Team B（`team-default` → TEAM_B_ID），即修改 `GroupsPage.tsx:33` `useState('team-default')`，或直接调 API 验证后端逻辑 | — | [ ] | L-09 限制 |
| M2-17 | 复制邀请码到 Invite Code 输入框，点 "Join"（带 Team B 上下文） | `POST /api/groups/join` body=`{invite_code, team_id=TEAM_B_ID}`，返回 `{success:true, group_id}` | [ ] | `groups.ts:314-386` |
| M2-18 | 加入成功后界面变化 | 左侧群列表多一条；选中后 Members 区域含 Team B（角色 member） | [ ] | `GroupsPage.tsx:93-97` `fetchGroups()` |
| M2-19 | **重复入群测试：** Team B 再次用同一码 Join | 错误提示 "Team already in this group" | [ ] | `groups.ts:356-362` |
| M2-20 | **过期码测试：** SQL 把 `groups.invite_code_expires_at` 改为 `now-1`，再 Join | 错误提示 "Invite code has expired" | [ ] | `groups.ts:345-348` |
| M2-21 | **无效码测试：** 输入 `ZZZZZZZZ`（不存在）点 Join | 错误 "Invalid invite code" | [ ] | `groups.ts:332-335` |
| M2-22 | **限次测试：** 用 API 生成 max_uses=1 的邀请码，先后两个团队 Join | 第二个返回 "Invite code has reached maximum uses" | [ ] | `groups.ts:351-353` |

### M2.4 退群与解散

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M2-23 | **UI 退群：** 在 Team B 上下文选中群，点击 "Leave Group"，确认弹窗后确定 | 返回 `{success:true}`，DB `group_members` 行删除，左侧列表刷新后该群消失 | [ ] | `GroupsPage.tsx:122-135` |
| M2-24 | **API 退群（兜底）：** `POST /api/groups/:id/leave` body=`{team_id=TEAM_B_ID}` | 返回 `{success:true}`，DB `group_members` 行删除 | [ ] | `groups.ts:389-429` |
| M2-25 | 刷新 Groups 页面（Team B 上下文） | 列表中不再有该群 | [ ] | |
| M2-26 | **owner 退群限制：** API 调 `leave` 用 `team-default` | 返回 400 "Group owner cannot leave. Delete the group instead." | [ ] | `groups.ts:410-412` |
| M2-27 | **UI 解散群：** 在 owner 上下文选中群，点击 "Delete Group"，确认弹窗后确定 | 返回 `{success:true}`，DB `groups`+`group_members` 行删除，左侧列表刷新后该群消失 | [ ] | `GroupsPage.tsx:137-146` |
| M2-28 | **API 解散群（兜底）：** `DELETE /api/groups/:id`（必须 owner 团队） | 返回 `{success:true}`，DB `groups`+`group_members` 行删除 | [ ] | `groups.ts:155-179` |
| M2-29 | 解散后刷新 Groups 页面 | 该群从列表消失 | [ ] | |
| M2-30 | 解散后查询 `GET /api/groups/:id` | 返回 404 "Group not found" | [ ] | |

### M2.5 群契约编辑器

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M2-31 | 选中已有群，观察契约编辑器区域 | 包含 Shared Capabilities 输入框、Authorization Mode 下拉、Trust Threshold 滑块、Max Tasks Per Hour 数字框、Max Retries Per Task 数字框、三个 visibility 复选框、Save Contract 按钮 | [ ] | `GroupsPage.tsx:260-346` |
| M2-32 | Authorization Mode 默认值 | 显示 "Manual"（与 DEFAULT_CONTRACT_YAML 对齐） | [ ] | `GroupsPage.tsx:279` |
| M2-33 | 切换 Authorization 为 "Auto" | 下拉显示 Auto；state 更新 | [ ] | `GroupsPage.tsx:280` onChange |
| M2-34 | 拖动 Trust Threshold 滑块到 0.7 | 滑块右下角显示 "0.7"（step=0.1） | [ ] | `GroupsPage.tsx:289-299` |
| M2-35 | Max Tasks Per Hour 默认 10，改成 20 | 输入框显示 20 | [ ] | `GroupsPage.tsx:301-309` |
| M2-36 | Max Retries Per Task 默认 3，改成 5 | 输入框显示 5 | [ ] | `GroupsPage.tsx:310-318` |
| M2-37 | 默认勾选状态 | "Show task input" / "Show task output" 勾选 ✅，"Show internal logs" 未勾选 ❌ | [ ] | `GroupsPage.tsx:319-343` |
| M2-38 | 点击 "Save Contract" | `PATCH /api/groups/:id/contract`，body 含 `authorization:auto, trust_threshold:0.7, resource_quota.max_tasks_per_hour:20, resource_quota.max_retry_per_task:5`，返回 `{success:true}` | [ ] | `groups.ts:227-271` |
| M2-39 | 刷新页面，再次进入该群 | 编辑器显示 Auto / 0.7 / 20 / 5，状态持久化 | [ ] | YAML 读写一致性 |
| M2-40 | **非法 trust_threshold：** API 直调 PATCH 设为 1.5 | 返回 400 "trust_threshold must be between 0 and 1" | [ ] | `groups.ts:252-257` |
| M2-41 | **非法 authorization：** API 直调 PATCH 设为 "invalid" | 返回 400 "authorization must be auto or manual" | [ ] | `groups.ts:248-251` |
| M2-42 | **Shared Capabilities：** UI 输入框填写 `code, review, python`，点击 Save | `PATCH /api/groups/:id/contract` body 含 `shared_capabilities: ["code","review","python"]`，刷新后持久化 | [ ] | `GroupsPage.tsx:265-276` |
| M2-43 | 直接 PATCH 修改 shared_capabilities 加 "python" | 后续 M4 群任务发布需要此能力 | [ ] | |

### M2.6 成员列表展示

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M2-44 | 群详情 Members 区域 | 列出所有成员团队（`team_name` + 角色 badge + ReputationBadge） | [ ] | `GroupsPage.tsx:245-258` |
| M2-45 | Owner 团队角色显示 | 角色 badge 显示 "owner" | [ ] | `groups.ts:60-62` |
| M2-46 | 通过邀请码加入的团队角色 | 角色 badge 显示 "member" | [ ] | `groups.ts:367-369` |
| M2-47 | 团队名称解析正确（非 UUID） | 通过 SQL JOIN `teams.name`，UI 显示真实名称 | [ ] | `groups.ts:96-100` |

---

## F. 模块三：Agents 页面 — 标签 (M3)

### M3.1 机器与 Agent 列表

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M3-01 | 进入 Agents 页面 | 顶部 "Machines & Agents" 标题，"+ Add Agent" 按钮 | [ ] | `AgentsPage.tsx:86-94` |
| M3-02 | 无机器时观察 | 显示 "No machines registered. Register a machine first." | [ ] | `AgentsPage.tsx:99-101` |
| M3-03 | 已有机器时观察 | 每台机器卡片：🖥 emoji + 名称 + ID 缩写 + 状态指示灯（绿/灰）| [ ] | `AgentsPage.tsx:104-120` |
| M3-04 | Agent 列表展示 | 缩进显示 Agent 名称、runtime badge、状态指示灯（awake=绿，sleeping=黄，running=蓝） | [ ] | `AgentsPage.tsx:122-146` |
| M3-05 | currentTaskId 不为空的 Agent | 显示 "Working" 蓝色文字 | [ ] | `AgentsPage.tsx:135-137` |
| M3-06 | DevTools Network | `GET /api/machines` 与 `/api/agents` 各调用 1 次 | [ ] | `AgentsPage.tsx:25-32` |

### M3.2 添加 Agent（含 labels 输入）

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M3-07 | 点 "+ Add Agent" | 弹出模态：Machine 下拉、Name 文本框、Runtime 下拉、Labels 文本框 | [ ] | `AgentsPage.tsx:167-243` |
| M3-08 | 填写：Machine=Machine A1, Name="ui-agent", Runtime=codex, Labels="python, review, python"，点 Add | `POST /api/agents` body 含 `labels: ["python","review"]`（去重、trim），返回 200，新 Agent 出现在列表 | [ ] | `AgentsPage.tsx:36-60` |
| M3-09 | 填写：Machine=Machine A1, Name="ui-agent-2", Runtime=codex, Labels 留空，点 Add | `POST /api/agents` body 含 `labels: []`，返回 200 | [ ] | `AgentsPage.tsx:36-60` |
| M3-10 | DB 验证：刚创建 Agent 的 labels 字段 | `SELECT labels FROM agents WHERE name='ui-agent';` 返回 `["python","review"]` | [ ] | `schema.sql:65` |
| M3-11 | 删除 Agent：点击列表项的 "Delete" 链接 | `DELETE /api/agents/:id` 返回 200，列表移除 | [ ] | `AgentsPage.tsx:62-71` |

### M3.3 Labels 显示与影响

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M3-12 | 通过 SQL 给 agent-a1 添加 labels=`["python","review"]`（若 M3-08 未创建） | `UPDATE agents SET labels='["python","review"]' WHERE id=...;` 成功 | [ ] | |
| M3-13 | 刷新 Agents 页面，观察 agent-a1 卡片 | Agent 卡片渲染 `python`、`review` labels badge | [ ] | `AgentsPage.tsx:140-144` |
| M3-14 | labels 为空时的显示 | 显示 "No labels" 或不显示 badge，但不报错 | [ ] | `AgentsPage.tsx:142-144` |
| M3-15 | 联邦 poll 端点验证 labels 生效 | `curl 'http://localhost:3000/api/federation/poll?team_id=...&labels=python,review'` 返回该团队群任务列表 | [ ] | `hub.ts:308-372` |
| M3-16 | labels 子集匹配：群任务 required_labels=`["python"]` | agent_labels 含 python 的 Runner poll 时能取到该任务 | [ ] | `hub.ts:347-348` |

---

## G. 模块四：群任务发布与跨团队 Claim (M4)

群任务核心流程：源团队发任务 → 跨团队 claim → 待审批 → 批准/拒绝 → 状态流转。

### M4.1 群任务发布（受限 L-06，使用 API）

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M4-01 | API 发布群任务（Team A 视角） | `POST /api/groups/:gid/tasks` body=`{title:"群任务-1", source_team_id:"team-default", creator_id:"user-default", required_capabilities:["python"]}` 返回 201 | [ ] | `group-tasks.ts:11-123` |
| M4-02 | 验证 task 是 group_task | `SELECT is_group_task, source_team_id FROM tasks WHERE id=...;` → `(1, "team-default")` | [ ] | `group-tasks.ts:75-93` |
| M4-03 | 验证 group_tasks 关联记录 | `SELECT * FROM group_tasks WHERE task_id=...;` → 含 group_id, source_team_id, authorization_status='none' | [ ] | `group-tasks.ts:95-100` |
| M4-04 | 验证 federation_task_index 索引 | `SELECT * FROM federation_task_index WHERE task_id=...;` → status='open' | [ ] | `group-tasks.ts:104-108`, `hub.ts:416-441` |
| M4-05 | **能力校验拒绝：** 发任务 required_capabilities=`["unknown"]`（不在群契约 shared_capabilities 中） | 返回 400 "Capabilities not in group contract shared_capabilities: unknown" | [ ] | `group-tasks.ts:55-69` |
| M4-06 | **非成员发任务：** Team C（未入群）发 | 返回 403 "Team is not a member of this group" | [ ] | `group-tasks.ts:46-53` |
| M4-07 | 在 Tasks 看板观察新任务 | 出现在 Pending 列；卡片显示 title、priority badge | [ ] | `TaskBoard.tsx` 拉取所有任务 |
| M4-08 | 群任务视觉标识 | TaskCard 显示 "Group" 标签、来源团队名称（通过 resolve-names 解析） | [ ] | `TaskCard.tsx:75-79`, `TaskCard.tsx:122-127` |
| M4-09 | 群任务列表 API | `GET /api/groups/:gid/tasks` 返回 task + authorization_status | [ ] | `group-tasks.ts:126-165` |

### M4.2 跨团队 Claim（生成授权请求）

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M4-10 | Team B 用 agent-b1 跨团队 claim：`POST /api/tasks/:tid/group-claim` body=`{agent_id:AGENT_B1_ID, team_id:TEAM_B_ID}` | 返回 `{success:true, authorization_request_id, status:"pending_authorization", expires_at}` | [ ] | `group-tasks.ts:168-322` |
| M4-11 | 验证 task 状态变更 | `SELECT status FROM tasks WHERE id=...;` → `pending_authorization` | [ ] | `group-tasks.ts:250` |
| M4-12 | 验证 group_tasks.authorization_status | → `pending` | [ ] | `group-tasks.ts:253` |
| M4-13 | 验证 authorization_requests 表 | 新行：requesting_team_id=TEAM_B_ID, requesting_agent_id=AGENT_B1_ID, expires_at=now+300 | [ ] | `group-tasks.ts:256-260` |
| M4-14 | **能力不匹配 claim：** agent-a2 (labels=[]) claim required_capabilities=python 任务 | 返回 400 `error_code: "CAPABILITY_MISMATCH"` | [ ] | `group-tasks.ts:227-243` |
| M4-15 | **同团队 claim 自己任务：** Team A claim 自己发的任务 | 返回 400 "Cannot claim your own team's task" | [ ] | `group-tasks.ts:218-221` |
| M4-16 | **非群成员 claim：** Team C claim | 返回 403 "Team is not a member of this group" | [ ] | `group-tasks.ts:209-216` |
| M4-17 | **重复 claim：** Team B 二次 claim 同任务 | 返回 400 "Task is not available for claiming" | [ ] | `group-tasks.ts:194-197` |
| M4-18 | Tasks 看板观察 | 任务出现在 **Authorization 列**；TaskCard 状态 badge 显示 "Awaiting Auth"（琥珀色） | [ ] | `TaskBoard.tsx:107-112`; `TaskCard.tsx:37` |
| M4-19 | TaskCard.statusConfig 覆盖 `pending_authorization` | badge 文案为 "Awaiting Auth"，颜色不是 fallback 灰色 | [ ] | `TaskCard.tsx:35-44` |

---

## H. 模块五：Authorizations 页面 — 闸门审批 (M5)

### M5.1 待审批列表展示

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M5-01 | M4-10 后立即进入 Authorizations 页面（Team A 视角） | 列表显示 1 个卡片：title="群任务-1"，agent_name=agent-b1，team_id 缩写，ReputationBadge，倒计时 ~5:00 | [ ] | `AuthorizationsPage.tsx:64-123` |
| M5-02 | 卡片字段完整性 | 显示：task_title、task_description（或 "No description"）、Agent: name(runtime)、Team: 截断 ID、Reputation: 分数徽章、倒计时、Approve / Reject 按钮 | [ ] | `AuthorizationsPage.tsx:69-123` |
| M5-03 | 倒计时格式 | `m:ss`（如 `4:58`），逐秒递减 | [ ] | `AuthorizationsPage.tsx:51-57` |
| M5-04 | 倒计时颜色：> 60s | 灰色 (`text-gray-400`) | [ ] | `AuthorizationsPage.tsx:75` |
| M5-05 | **倒计时 ≤ 60s 变红：** SQL 把 `expires_at` 改为 `now+30` 后刷新 | 颜色变红 (`text-red-400`) | [ ] | `AuthorizationsPage.tsx:75` |
| M5-06 | 自动刷新机制 | 保持页面打开 11 秒，观察 Network 出现第二次 `GET /pending` | [ ] | `AuthorizationsPage.tsx:29-31` 10s 间隔 |
| M5-07 | ⚠️ 团队 ID 截断显示 | "Team:" 后只显示前 8 字符（L-10），不可见完整团队名 | [ ] | `AuthorizationsPage.tsx:81` |

### M5.2 批准流程

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M5-08 | 点击 "Approve" 按钮 | `POST /api/authorizations/:id/approve`，返回 `{success:true, status:"approved"}` | [ ] | `authorizations.ts:43-106` |
| M5-09 | 卡片消失 | 列表立即移除该卡片（fetchPending 重新拉取） | [ ] | `AuthorizationsPage.tsx:36-38` |
| M5-10 | DB 验证 task 状态 | `SELECT status, assignee_id, claimed_at FROM tasks WHERE id=...;` → `claimed`, agent-b1, now | [ ] | `authorizations.ts:80-83` |
| M5-11 | DB 验证 group_tasks | `authorization_status=approved, authorized_at=now` | [ ] | `authorizations.ts:86-89` |
| M5-12 | DB 验证 authorization_requests | `status=approved, resolved_at=now` | [ ] | `authorizations.ts:92-95` |
| M5-13 | Tasks 看板验证 | 该任务从 Pending 列移到 In Progress 列（status=claimed） | [ ] | `TaskBoard.tsx:101-106` |
| M5-14 | TaskCard 显示 assignee | 显示 agent-b1 名称 | [ ] | `TaskCard.tsx:107-112` |

### M5.3 拒绝流程

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M5-15 | 重新制造一个 pending 授权请求（重发任务+claim） | Authorizations 页面再次出现卡片 | [ ] | |
| M5-16 | 点击 "Reject" | `POST /api/authorizations/:id/reject` 返回 `{success:true, status:"rejected"}` | [ ] | `authorizations.ts:109-159` |
| M5-17 | DB 验证 task 状态 | `status=pending, assignee_id=NULL`（回池） | [ ] | `authorizations.ts:136` |
| M5-18 | DB 验证 group_tasks | `authorization_status=rejected` | [ ] | `authorizations.ts:139-141` |
| M5-19 | Tasks 看板 | 任务回到 Pending 列 | [ ] | |
| M5-20 | 其他 Agent 重新 claim：Team B 用 agent-b1 再次 group-claim | 成功，再生成 pending_authorization | [ ] | |

### M5.4 过期流程

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M5-21 | SQL 把待审批 expires_at 改为 `now-1` | — | [ ] | |
| M5-22 | 等待 30 秒（authCheckInterval） | 后台 `checkExpiredAuthorizations()` 触发 | [ ] | `index.ts:199`, `authorizations.ts:163-191` |
| M5-23 | DB 验证：authorization_requests | status=expired, resolved_at=now | [ ] | `authorizations.ts:181` |
| M5-24 | DB 验证：group_tasks | authorization_status=expired | [ ] | `authorizations.ts:182` |
| M5-25 | DB 验证：tasks | status=pending（回池） | [ ] | `authorizations.ts:183` |
| M5-26 | 服务器日志 | `[auth] Authorization expired: {id} for task {tid}` | [ ] | `authorizations.ts:184` |
| M5-27 | Authorizations 页面 | 该卡片在下一次自动刷新时消失 | [ ] | |
| M5-28 | **手动批准已过期请求：** UI 还显示时点 Approve（争用） | 返回 400 "Authorization request has expired" | [ ] | `authorizations.ts:67-76` |

### M5.5 自动授权（auto 模式）

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M5-29 | 把群契约改为 `authorization=auto, trust_threshold=0.5` | UI 或 API 保存 | [ ] | M2.5 已验证 |
| M5-30 | 给 Team B 累计正信誉（先完成几个任务+review_approved） | `SELECT total_score FROM ... WHERE team_id=TEAM_B_ID;` ≥ 信誉阈值对应分数 | [ ] | `reputation.ts:checkThreshold` |
| M5-31 | Team B claim 新任务 | 后端 auto-approve，返回 `{auto_approved: true, status:"claimed"}` | [ ] | `group-tasks.ts:281-307` |
| M5-32 | Authorizations 页面 | **不**生成 pending 卡片（直接通过） | [ ] | |
| M5-33 | DB 验证 authorization_requests | 新行 status=approved（已自动批准） | [ ] | `group-tasks.ts:294-297` |
| M5-34 | **信誉不足时 fallback：** 把 Team B 信誉刷为 0，再 claim | 走 manual 流程，pending_authorization | [ ] | `group-tasks.ts:307` |

---

## I. 模块六：信誉分系统 (M6)

### M6.1 信誉记录生成

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M6-01 | 完成一个跨团队群任务（agent-b1 claim → 完成 → review_approved） | reputation_records 新增一行：team_id=TEAM_B_ID, group_id, event_type=review_approved, score_delta>0 | [ ] | `reputation.ts:recordReputation` |
| M6-02 | review_rejected 后果 | reputation_records 新增 score_delta<0 的行 | [ ] | `reviews.ts:63` |
| M6-03 | task_completed 自动加分 | （若实现）completion 时调 recordReputation('task_completed', ...) | [ ] | 检查 `task-queue.ts` 是否调用 |
| M6-04 | task_failed 自动减分 | （若实现）failure 时调 recordReputation('task_failed', ...) | [ ] | 检查 `task-queue.ts` 是否调用 |

### M6.2 信誉查询 API

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M6-05 | `GET /api/groups/:gid/reputation` | 返回数组：每个团队 `{team_id, total_score, event_count, last_event_at}` | [ ] | `reputation.ts:7-38` |
| M6-06 | `GET /api/groups/:gid/reputation/:tid` | 返回单团队信誉 + 默认值（无记录时返回 0） | [ ] | `reputation.ts:41-70` |
| M6-07 | 不存在的群 | 返回 404 "Group not found" | [ ] | `reputation.ts:14-17` |

### M6.3 ReputationBadge 渲染

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M6-08 | GroupsPage 成员列表渲染 ReputationBadge | 每个成员团队行显示信誉分数徽章（≥5 绿 / 1-4 黄 / ≤0 红） | [ ] | `GroupsPage.tsx:245-258` |
| M6-09 | AuthorizationsPage 审批卡片渲染 ReputationBadge | 卡片显示 claim 团队信誉分数徽章 | [ ] | `AuthorizationsPage.tsx:69-123` |
| M6-10 | 单元测试覆盖（已通过） | `npm test` / packages/web vitest GroupsPage.test.tsx → TC-G026-001 信誉徽章颜色映射 | [ ] | 自动化测试已 |

---

## J. 模块七：Review 工作流 (M7)

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M7-01 | UI 入口：点击已完成的群任务卡片打开 TaskDetailModal | 详情底部显示 Review 区域：output、Approve、Reject 按钮 | [ ] | `TaskDetailModal.tsx:409-442` |
| M7-02 | UI 提交 review approved：点击 "Approve" | `POST /api/tasks/:tid/review` body `{decision:"approved", reviewer_id}`；返回 `{success:true, decision:"approved"}`；reputation_records 增加 review_approved | [ ] | `TaskDetailModal.tsx:426-436`; `reviews.ts:48-58` |
| M7-03 | task 状态保持 completed | 不回退 | [ ] | |
| M7-04 | UI 提交 review rejected：点击 "Reject" | `POST /api/tasks/:tid/review` body `{decision:"rejected", reviewer_id}`；task 状态回退为 pending，assignee_id=NULL；group_tasks.authorization_status=none；reputation_records 增加 review_rejected (负分) | [ ] | `TaskDetailModal.tsx:437-442`; `reviews.ts:60-73` |
| M7-05 | Tasks 看板验证 rejected 后 | 任务回到 Pending 列 | [ ] | |
| M7-06 | **未完成任务 review：** 对 status=pending 的任务调 review | 返回 400 "Task must be completed before review" | [ ] | `reviews.ts:32-34` |
| M7-07 | **非群任务 review：** 对内部任务调 review | 返回 400 "Task is not a group task" | [ ] | `reviews.ts:36-44` |
| M7-08 | **非法 decision：** body=`{decision:"unknown"}` | 返回 400 "decision must be approved or rejected" | [ ] | `reviews.ts:12-14` |

---

## K. 模块八：联邦网关 UI 联动 (M8)

联邦底层协议已在 `docs/federation-e2e-manual-test-guide.md` 单独验证。本节只校核 **Web UI 是否如实反映联邦状态**。

### M8.1 Federation Hub WebSocket 连接

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M8-01 | Hub 启动后日志 | `[server] WebSocket endpoints: /ws, /daemon/connect, /federation` | [ ] | `index.ts:256` |
| M8-02 | Runner 连接（Team B 端）：设置 `FEDERATION_URL`、`FEDERATION_INVITE_CODE`、`FEDERATION_TEAM_ID` 启动第二个 server | Hub 日志 `[federation-hub] New Runner connection` + `Peer registered: TEAM_B_ID` | [ ] | `hub.ts:280, 107` |
| M8-03 | DB 验证 federation_peers | 新行：team_id=TEAM_B_ID, status=connected, last_heartbeat | [ ] | `hub.ts:80-88` |
| M8-04 | UI 联邦状态面板 | Settings 页面 Federation Peers 区域显示已连接 peer：teamName、groupName、status badge、labels、lastHeartbeat | [ ] | `SettingsPage.tsx:159-187` |

### M8.2 Federation Task Index（poll 触发）

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M8-05 | M4-04 已发布的群任务 | federation_task_index 中 status=open | [ ] | |
| M8-06 | Runner poll：`GET /api/federation/poll?team_id=TEAM_B_ID&labels=python` | 返回 tasks 数组，含该任务 taskId 和 requiredLabels | [ ] | `hub.ts:308-372` |
| M8-07 | 标签不匹配过滤：labels=java | 返回空列表 | [ ] | `hub.ts:347-348` |
| M8-08 | 未注册团队 poll | 返回 403 "Team not registered with this hub" | [ ] | `hub.ts:316-318` |

### M8.3 出入群广播

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M8-09 | Runner 注册后 | Hub 广播 `federation.member.joined` 给同 group 其他 peers | [ ] | `hub.ts:101-105` |
| M8-10 | Runner 主动断开 (process kill) | Hub 检测 close → broadcast `federation.member.left` | [ ] | `hub.ts:127-130, 287-294` |
| M8-11 | 心跳超时（120s）触发 | Hub 自动 disconnect peer，状态更新为 disconnected | [ ] | `hub.ts:46-57` |
| M8-12 | 已 claim 但未完成的联邦任务回收 | `federation_task_index.status=claimed → open`，`claimed_by_team_id` 重置 | [ ] | `hub.ts:133-138` |

### M8.4 Federation Agent Wake

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M8-13 | 跨团队批准后远程 Agent 唤醒 | Hub 调用 `wakeFederationAgent` 发送 `federation.agent.wake` 给 Runner | [ ] | `hub.ts:489-508` |
| M8-14 | `POST /api/federation/claim` 真实实现 | 更新 `federation_task_index.status='claimed'`，返回 `{success:true, authorization_request_id, status:"pending_authorization"}` | [ ] | `hub.ts:416-482` |
| M8-15 | ⚠️ **剩余 TODO：** `handleClaim` WebSocket 路由仍只 console.log | 检查 `hub.ts:271-274` 注释 "TODO: Route claim to source team server (STORY-F012)" | [ ] | REST claim 已完整；WS claim 路由待后续实现 |

---

## L. 模块九：Tasks 页面与群任务交互 (M9)

### M9.1 群任务在 TaskBoard 的展示

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M9-01 | 进入 Tasks 页面，混合内部任务 + 群任务 | 看板 4 列正常显示：Pending / Authorization / In Progress / Completed | [ ] | `TaskBoard.tsx:99-128` |
| M9-02 | 群任务卡片 vs 内部任务卡片视觉差异 | 群任务卡片显示 "Group" 标签、来源团队名称、 authorization_status badge | [ ] | `TaskCard.tsx:75-79`, `TaskCard.tsx:122-127` |
| M9-03 | 任务详情弹窗（点击群任务卡片） | 显示完整 ID、Creator、Assignee、Group、Source Team、Authorization Status（解析为名称） | [ ] | `TaskDetailModal.tsx:278-323` |
| M9-04 | Creator/Assignee 名称解析 | 通过 `/api/resolve-names` 返回真实名（user-default、agent-b1） | [ ] | `TaskBoard.tsx:35-52` |
| M9-05 | 群任务的 source_team_id 字段 | TaskCard 渲染来源团队，如 "Source: Team B" | [ ] | `TaskCard.tsx:122-127` |

### M9.2 状态流转可视化

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M9-06 | pending → claimed | 卡片从 Pending 列移到 In Progress 列 | [ ] | `TaskBoard.tsx:113-118` |
| M9-07 | claimed → running | 仍在 In Progress 列；status badge 颜色变浅蓝 | [ ] | `TaskCard.tsx:35-44` |
| M9-08 | running → completed | 移到 Completed 列；status badge 绿色 "Done" | [ ] | |
| M9-09 | completed → review (rejected) → pending | 回到 Pending 列 | [ ] | M7-04 |
| M9-10 | pending_authorization 状态 | TaskCard 显示 "Awaiting Auth" 琥珀色 badge；TaskBoard 有独立 Authorization 列 | [ ] | `TaskCard.tsx:37`; `TaskBoard.tsx:107-112` |
| M9-11 | TaskBoard 分栏逻辑 | `pending_authorization` 明确归类到 Authorization 列 | [ ] | `TaskBoard.tsx:99-128` |
| M9-12 | 所有 8 种 task.status 均有 UI 映射 | pending / pending_authorization / claimed / running / decomposing / verifying / completed / failed 均不落入 fallback 灰色 | [ ] | `TaskCard.tsx:35-44` |

### M9.3 Force Override 操作

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M9-13 | 任务详情弹窗中 Force Complete 按钮 | 在 status ≠ completed/failed 时可见 | [ ] | `TaskDetailModal.tsx:347-355` |
| M9-14 | 点击 Force Complete | `POST /api/tasks/:tid/force-complete`，状态变 completed | [ ] | `TaskDetailModal.tsx:184-189` |
| M9-15 | 点击 Force Fail | 状态变 failed | [ ] | `TaskDetailModal.tsx:193-199` |

### M9.4 协作模式与子任务（v0.1.0 已验证，本版回归）

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M9-16 | 创建 collaborate 模式群任务 | 走完整协作流程，子任务执行 → verify → completed | [ ] | §8 已验证，本次确认未回归 |
| M9-17 | 子任务树展示 | 详情中显示 "Subtasks (n/m)" 进度 | [ ] | `TaskDetailModal.tsx:368-454` |
| M9-18 | 子任务详情弹窗（递归） | 点 "detail" 链接展开子任务详情 | [ ] | `TaskDetailModal.tsx:493-501` |

---

## M. 模块十：跨团队聊天（轻量验证）(M10)

| # | 步骤 | 预期结果 | 状态 | 关联代码 |
|---|------|----------|------|----------|
| M10-01 | 群成员是否在同一聊天频道 | ⚠️ 当前**没有自动创建群聊频道**的逻辑（设计缺口） | [ ] | 检查 `groups.ts` 创建群时无 channels 创建 |
| M10-02 | 手动把 agent-b1 加入 #general 频道 | 通过 `POST /api/channels/:id/members` 或 daemon 自动加入 | [ ] | |
| M10-03 | Team B 用户访问 Chat 页面 | MemberList 显示 agent-b1（机器人图标） | [ ] | `MemberList.tsx` |
| M10-04 | @mention agent-b1 | 触发 daemon 自动回复 | [ ] | v0.1.0 已验证 |
| M10-05 | 跨团队消息发送 | 消息发送者名称解析正确 | [ ] | v0.1.0 已验证 |

---

## N. 验证结果汇总

| 模块 | 总项数 | 通过 ✅ | 失败 ❌ | 跳过 ⏭️ | 备注 |
|------|--------|---------|---------|---------|------|
| C 环境检查 | 10 | | | | |
| D 测试数据准备 | 8 | | | | |
| M1 导航与路由 | 15 | | | | |
| M2 Groups 群生命周期 | 47 | | | | |
| M3 Agents 标签 | 16 | | | | |
| M4 群任务发布与 Claim | 19 | | | | |
| M5 Authorizations 闸门 | 34 | | | | |
| M6 信誉分 | 10 | | | | |
| M7 Review 工作流 | 8 | | | | |
| M8 联邦网关 UI 联动 | 15 | | | | |
| M9 Tasks 页面交互 | 18 | | | | |
| M10 跨团队聊天 | 5 | | | | |
| **总计** | **205** | | | | |

---

## O. 已识别的 UI 缺口（建议下一迭代修复）

按严重度排序，源自验证过程。**仅在验证通过、并完整记录后**才能合并到 backlog：

### v0.2.0 follow-up 已关闭的缺口

| 编号 | 缺口描述 | 关闭方式 |
|------|----------|----------|
| GAP-01 | Add Agent 模态框无 labels 输入 | G028：AgentsPage 增加 Labels 输入与展示 |
| GAP-02 | TaskCard 不区分群任务/内部任务 | G029：TaskCard 增加 Group 标签与来源团队 |
| GAP-03 | TaskCard.statusConfig 缺 `pending_authorization` 映射 | G029：增加 "Awaiting Auth" 琥珀色映射 |
| GAP-04 | TaskBoard 不显示 pending_authorization 任务 | G029：增加 Authorization 列 |
| GAP-05 | GroupsPage 无 Leave / Delete 按钮 | G027：增加 Leave Group / Delete Group 按钮 |
| GAP-06 | ReputationBadge 未在任何页面渲染 | G030：接入 GroupsPage 成员列表与 AuthorizationsPage |
| GAP-07 | 无 Review 工作流 UI | G031：在 TaskDetailModal 增加 Review 区域 |
| GAP-09 | GroupsPage shared_capabilities 无 UI 编辑入口 | G027：契约编辑器增加 Shared Capabilities 输入框 |
| GAP-10 | 无 Federation Peers 状态面板 | F011：SettingsPage 增加 Federation Peers 区域 |
| GAP-11 | Settings 页 version 硬编码 0.1.0 | Q001 / 工程化：`/api/server-info` 动态读取根 package.json |
| GAP-12 | hub.ts `POST /api/federation/claim` 返回 mock | F012：实现真实 claim 与并发控制 |

### 仍开放的缺口

| 编号 | 缺口描述 | 严重度 | 影响范围 | 建议 |
|------|----------|--------|----------|------|
| GAP-06a | ReputationBadge 点击无详情弹窗（事件列表） | 低 | 用户无法查看信誉分明细 | v0.3.0 可选 |
| GAP-08 | Authorizations 页 team_id 截断显示 | 低 | 团队识别困难 | v0.3.0 UI polish |
| GAP-12a | hub.ts `handleClaim` WebSocket 路由仍只 console.log | 低 | WS 路径联邦 claim 未完整 | 待实际需求确认 |
| GAP-13 | groups.ts leave 注释 TODO："Reset claimed tasks back to pending pool" | 低 | 退群后任务清理可能不完全 | v0.3.0 数据清理 |
| GAP-14 | 多处 WebSocket 通知 TODO | 中 | authorization.requested/approved 等靠轮询 | v0.3.0 实时性增强 |
| GAP-15 | 无 Group Tasks 专属页面 | 中 | 群任务混在 Tasks 看板，来源不够直观 | v0.3.0 可选 |
| GAP-16 | Authorizations 页面 team_id 写死为 `team-default` | 中 | 多团队审批方切换需 hardcode | v0.3.0 RBAC / 团队切换 |

---

## P. 验证签名

- **验证开始日期：** ___________
- **验证完成日期：** ___________
- **总耗时：** ___________
- **验证人：** ___________
- **审核人：** ___________

### 决策
- ⬜ **GO** — 全部验证通过，无阻塞缺陷，可发布
- ⬜ **CONDITIONAL GO** — 部分跳过/缺陷已记录但不阻塞，附补丁计划
- ⬜ **NO-GO** — 存在阻塞缺陷，需修复后重新验证

### 补充说明
（在此填写验证过程中发现的非缺口性问题、修复 PR 链接、回归测试覆盖建议等）

---

## Q. 验证时间线

| 时间 | 模块 | 操作 | 结果 |
|------|------|------|------|
| | C 环境检查 | | |
| | D 测试数据准备 | | |
| | M1 导航 | | |
| | M2 Groups | | |
| | ... | | |

