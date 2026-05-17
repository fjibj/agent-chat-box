# Agent Chat Box 人工验证记录

**项目版本:** v0.1.0
**验证日期:** 2026-05-02
**验证环境:** 两台 Windows 10 电脑，通过 Tailscale 组网

---

## 1. 验证环境

### 网络拓扑

```
┌─────────────────┐         Tailscale          ┌─────────────────┐
│   家里电脑       │ ◄═══════════════════════► │   公司电脑       │
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

# 附录：群扩展 & 联邦网关 Web UI 人工验证清单（v0.2.0）

**Date:** 2026-05-16
**Scope:** 群级扩展 (G001~G026) + 联邦网关 (F001~F010) 的 Web 界面功能
**Note:** 联邦底层协议（Runner 反向 WSS 连接、心跳、poll 轮询、自动重连、出入群广播等）已在 `docs/federation-e2e-manual-test-guide.md` 中完成验证，本清单聚焦 **Web UI 操作与相关后端联动**。
**Verifier:** _____________

---

## 验证前准备

### 环境检查
- [ ] 服务器启动无报错，`/api/health` 返回 ok
- [ ] 233 个自动化测试全部通过 (`cd packages/server && npx vitest run`)
- [ ] Web UI 可访问：`http://localhost:3000`
- [ ] 至少已注册 1 台 Machine 和 1 个 Agent（用于任务认领验证）

### 测试数据准备
本验证需要**两个团队**上下文。建议预置方式（可通过 UI 或 API）：
- **Team A（群主团队）**：用于创建群、发布群任务、审批授权
- **Team B（成员团队）**：用于入群、跨团队 claim、生成授权请求

> 提示：若先通过 API 预置团队/群/Agent，可让 UI 验证更聚焦界面本身。预置脚本可参考 `docs/federation-e2e-manual-test-guide.md` 步骤 1~3。

---

## 模块一：导航栏与路由

验证顶部导航栏新增菜单项是否正确渲染，路由切换是否正常，页面挂载时数据加载是否成功。

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-01 | 浏览器打开 `http://localhost:3000` | 页面加载，默认进入 Chat 页面 | [ ] | `App.tsx` `BrowserRouter`，`/` 路由映射；`ChatPage.tsx` 挂载 |
| V-UI-02 | 观察顶部导航栏 | 显示 6 个链接：Chat、Tasks、Groups、Authorizations、Agents、Settings | [ ] | `App.tsx` nav 区域，`ROUTES` 常量包含 `/` `/tasks` `/groups` `/authorizations` `/agents` `/settings` |
| V-UI-03 | 点击 "Groups" | 路由切换到 `/groups`，左侧显示群列表面板，右侧显示群详情或空状态提示 | [ ] | `GroupsPage.tsx` 挂载；`useEffect` 中调用 `GET /api/groups?team_id=` 加载群列表 |
| V-UI-04 | 点击 "Authorizations" | 路由切换到 `/authorizations`，显示授权请求列表页面 | [ ] | `AuthorizationsPage.tsx` 挂载；`useEffect` 中调用 `GET /api/authorizations/pending?team_id=` |
| V-UI-05 | 点击 "Agents" | 路由切换到 `/agents`，显示机器与 Agent 列表面板 | [ ] | `AgentsPage.tsx` 挂载；并发调用 `GET /api/machines` + `GET /api/agents` 聚合数据 |
| V-UI-06 | 点击 "Tasks" | 路由切换到 `/tasks`，显示任务看板（Kanban：Pending / In Progress / Completed） | [ ] | `TaskBoard.tsx` 挂载；`GET /api/tasks` 拉取全部任务并按 `status` 分栏渲染 |

---

## 模块二：Groups 页面 — 群生命周期管理

重点验证群的创建、加入、契约配置、邀请码生成、成员管理等核心功能。每一步 UI 操作同步验证前端状态管理、REST API 调用、后端业务规则与数据持久化。

### 2.1 群列表与创建

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-07 | 进入 Groups 页面，观察左侧列表 | 若已有群，显示群名称列表；若无，显示空状态提示（如 "No groups yet"） | [ ] | `GroupsPage.tsx` sidebar 区域渲染 `groups` state；`GET /api/groups?team_id=` 响应结构 |
| V-UI-08 | 点击左侧 "+ New" 按钮 | 弹出创建群表单，包含 Name / Description / Owner Team 下拉选择 | [ ] | `GroupsPage.tsx` `showCreateForm` state 控制表单显隐；表单受控组件绑定 |
| V-UI-09 | 填写 Name="UI-Test-Group"，Description="for manual verification"，选择 Owner Team，点击 "Create" | 表单关闭，左侧列表新增该群，右侧自动加载群详情；网络面板可见 `POST /api/groups` 请求 | [ ] | `POST /api/groups` → `db/schema.sql` `groups` 表插入记录；返回体包含自动生成的 `contract_yaml` 默认值（`shared_capabilities` / `authorization: manual` / `trust_threshold: 0.5`） |
| V-UI-10 | 观察右侧群详情头部 | 显示群名称、Description、"Invite Code" 按钮；若为成员身份则显示 "Leave" 按钮 | [ ] | `GroupsPage.tsx` detail header 渲染；`GET /api/groups/:id` 返回 `name`、`description`、`members` 数组；前端根据 `currentTeamId` 判断 owner/member 角色 |

### 2.2 邀请码与入群

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-11 | 在群详情中点击 "Invite Code" 按钮 | 弹出/显示邀请码（8 位大写字母数字），显示有效期和最大使用次数 | [ ] | `POST /api/groups/:id/invite` 返回 `invite_code`、`expires_at`、`max_uses`；前端将邀请码渲染到弹窗或提示框 |
| V-UI-12 | 复制邀请码，在左侧 "Invite Code" 输入框粘贴，选择要加入的 Team，点击 "Join" | 左侧列表刷新，该群成员列表新增加入的团队 | [ ] | `POST /api/groups/join` → 后端校验 `invite_code` 有效性 → 写入 `group_members` 表 → 返回 `{ success: true, group_id }`；前端重新调用 `GET /api/groups/:id` 刷新详情 |
| V-UI-13 | 再次用同一邀请码尝试让同一团队加入 | 界面提示错误信息（如 "Team already in this group"），不重复添加 | [ ] | 后端 `groups.ts` 重复入群校验返回 400；前端将 `error` 字段渲染为红色提示 |

### 2.3 群契约编辑器

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-14 | 在群详情中找到契约编辑器（Contract Editor）区域 | 显示 Authorization Mode 下拉框、Trust Threshold 滑块 (0-1)、Max Tasks/Hour 数字输入、Visibility 复选框组（Task Output / Internal Log） | [ ] | `GroupsPage.tsx` contract editor 区域；`GET /api/groups/:id/contract` 返回 YAML 解析后的 JSON 对象；前端映射到各表单控件 |
| V-UI-15 | 将 Authorization Mode 从 "manual" 改为 "auto" | 下拉框显示 "auto"；滑块和输入框仍保持可编辑状态 | [ ] | 前端 `select` 受控组件更新 state；`PATCH /api/groups/:id/contract` 时 `authorization` 字段值为 `"auto"`；后端存储为 YAML 字符串 |
| V-UI-16 | 拖动 Trust Threshold 滑块到 0.3 | 滑块实时显示 0.3（或对应百分比标签） | [ ] | `GroupsPage.tsx` `input[type="range"]` 绑定 `trust_threshold`（0~1 浮点数）；影响 auto 授权模式下是否自动通过 claim |
| V-UI-17 | 修改 Max Tasks Per Hour 为 10 | 输入框显示 10，无校验错误提示 | [ ] | `GroupsPage.tsx` `input[type="number"]` 绑定 `max_tasks_per_hour`；后端契约约束中的速率限制参数 |
| V-UI-18 | 勾选 "Task Output" visibility，取消勾选 "Internal Log" | 两个复选框状态同步更新，互不影响 | [ ] | `visibility` 对象结构 `{ task_output: boolean, internal_log: boolean }`；控制跨团队任务产出可见范围 |
| V-UI-19 | 在 Shared Capabilities 中添加 "python"（若 UI 支持直接编辑；否则通过 API 预置后刷新） | 契约中包含 `python` 能力项；保存后刷新页面仍存在 | [ ] | `contract_yaml` 中的 `shared_capabilities` 数组；`group-tasks.ts` 发布任务时校验 `required_capabilities` 必须为该数组子集 |
| V-UI-20 | 点击 "Save Contract" | 按钮进入 loading 状态或短暂禁用，随后提示保存成功；刷新页面后契约配置保持 | [ ] | `PATCH /api/groups/:id/contract` → 后端 YAML 序列化存储 → `GET /api/groups/:id/contract` 读取持久化数据；验证端到端数据一致性 |

### 2.4 成员列表与退群

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-21 | 观察群详情中的 Members 区域 | 显示所有成员团队（owner + 已加入的成员），含团队名称和角色标识（Owner / Member） | [ ] | `GET /api/groups/:id` 返回 `members` 数组（含 `team_id`、`role`、`joined_at`）；前端渲染角色标签 |
| V-UI-22 | 成员团队视角点击 "Leave Group"（或等效退群操作） | 确认后退群成功，该群从左侧列表消失；群主视角刷新后成员列表中该团队消失 | [ ] | `POST /api/groups/:id/leave` → 删除 `group_members` 记录 → 若该团队为联邦 Runner，触发 `hub.ts` `disconnectPeer` 清理 `federation_task_index` 中该团队已 claim 但未完成的任务（状态重置为 `open`） |

---

## 模块三：Authorizations 页面 — 授权闸门

验证跨团队任务 claim 后生成的授权请求在前端的展示、审批、拒绝流程，以及自动刷新机制。

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-23 | **前置：**通过 API 或群任务 UI 发布一个群任务，并用 Team B 的 Agent 执行 `group-claim`，使任务进入 `pending_authorization` 状态 | — | [ ] | `POST /api/groups/:groupId/tasks` + `POST /api/tasks/:id/group-claim`；后端生成 `authorization_requests` 表记录，状态为 `pending`，含 5 分钟倒计时 `expires_at` |
| V-UI-24 | 点击导航栏 "Authorizations" | 页面显示待授权请求列表，每个卡片包含：任务标题、描述、申请 Agent 名称、请求团队名称、剩余有效期倒计时 | [ ] | `AuthorizationsPage.tsx` 挂载；`useEffect` 中轮询 `GET /api/authorizations/pending?team_id=`（10 秒间隔）；卡片组件渲染 `task_title`、`agent_name`、`requesting_team_id`、`expires_at` |
| V-UI-25 | 观察授权请求卡片按钮 | 每个请求卡片显示 "Approve"（绿色/主色）和 "Reject"（红色/危险色）两个按钮 | [ ] | `AuthorizationsPage.tsx` 按钮渲染；`authorization` 状态机设计：`pending` → `approved` / `rejected` / `expired` |
| V-UI-26 | 点击 "Approve" | 该卡片从列表移除（或状态变为已批准），对应任务状态流转为 `claimed` | [ ] | `POST /api/authorizations/:id/approve` → 更新 `authorization_requests` 状态为 `approved` → 任务表 `status` 变更为 `claimed` → 若为联邦任务，触发 `wake-engine.ts` `federation_claim` wake 类型，向 Runner 发送 `agent.wake` 消息 |
| V-UI-27 | 重新制造一个 pending 授权请求，点击 "Reject" | 卡片从列表移除，对应任务状态回退为 `pending`，可被再次 claim | [ ] | `POST /api/authorizations/:id/reject` → `authorization_requests` 状态变为 `rejected` → `group-tasks.ts` 将任务 `status` 回写为 `pending`（回池逻辑） |
| V-UI-28 | 保持页面打开，等待 >10 秒 | 页面自动刷新数据，与后端同步；无明显页面闪烁或滚动条复位 | [ ] | `AuthorizationsPage.tsx` `setInterval(10000)` 自动刷新；验证前端状态更新策略（增量更新 vs 全量刷新） |

---

## 模块四：Agents 页面 — Agent 标签（Labels）

验证 Agent 注册及 `labels` 字段在前端的展示。注意：当前 UI 的 "Add Agent" 表单缺少 `labels` 输入框，需在验证中记录此已知限制。

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-29 | 进入 Agents 页面 | 显示机器列表，每台机器可展开/折叠，显示其下属 Agent（名称、Runtime、状态 badge） | [ ] | `AgentsPage.tsx` 渲染逻辑；并发 `GET /api/machines` + `GET /api/agents` 数据聚合；按 `machine_id` 分组展示 |
| V-UI-30 | 观察已有 Agent 卡片 | 若该 Agent 在数据库中有 `labels` 数据（通过 API 预置或 DB 写入），卡片应显示标签列表 badge（如 `python`、`review`、`linux`） | [ ] | `api/agents.ts` 返回 `labels` 字段（`schema.sql` v9 新增 `TEXT DEFAULT '[]'`）；前端渲染标签 chip/badge 列表 |
| V-UI-31 | 点击 "+ Add Agent" | 弹出创建模态框，包含 Machine 下拉选择、Name 文本输入、Runtime 单选/下拉选择 | [ ] | `AgentsPage.tsx` modal 组件；`POST /api/agents` 参数校验（`machineId`、`name`、`runtime` 必填） |
| V-UI-32 | **已知限制验证：** 观察 Add Agent 模态框 | 当前 UI **缺少 `labels` 输入字段**。创建 Agent 后，后端默认 `labels` 为空数组 `[]` | [ ] | `AgentsPage.tsx` modal 表单组件未实现 `labels` 输入；`api/agents.ts` 中 `labels` 参数默认 `JSON.stringify([])`；联邦标签匹配 (`hub.ts` `checkLabelMatch`) 数据源依赖此字段 |
| V-UI-33 | 通过 API 为刚创建的 Agent 添加 labels `["python","review"]`，刷新 Agents 页面 | Agent 卡片正确显示 `python`、`review` 标签 badge | [ ] | 验证前端是否正确读取并渲染 `labels` 字段；`PATCH /api/agents/:id` 或 `POST /api/agents` 直接携带 labels；与联邦 poll 标签过滤逻辑的数据链路完整性 |

---

## 模块五：Tasks 页面 — 群任务看板

验证群任务在任务看板中的展示、状态流转视觉反馈、以及群任务与内部任务的区分。

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-34 | 进入 Tasks 页面 | 看板显示三列：Pending / In Progress / Completed；列标题与任务卡片正常渲染 | [ ] | `TaskBoard.tsx` Kanban 布局；`GET /api/tasks` 拉取所有任务（含 `is_group_task=1` 的群任务） |
| V-UI-35 | **前置：**已通过 API 或群页面创建群任务 | 群任务出现在 Pending 列；任务卡片显示标题、优先级 badge（High/Medium/Low）、模式 badge（compete/assign/collaborate） | [ ] | `TaskCard.tsx` 渲染逻辑；`GET /api/tasks` 返回群任务的 `priority`、`mode`、`status` 字段；badge 颜色与文本按枚举映射 |
| V-UI-36 | 观察群任务卡片视觉标识 | 卡片应标识为群任务（如显示 "GROUP" 标签、地球图标、或来源团队名称，若 UI 已实现） | [ ] | `TaskCard.tsx` 对 `is_group_task` 或 `source_team_id` 的视觉处理；`GET /api/resolve-names` 解析来源团队名称替代 UUID |
| V-UI-37 | 点击群任务卡片打开详情 | 弹出详情模态框，显示：标题、描述、当前状态、模式、创建者名称（非 UUID）、认领者名称（如有）、子任务进度条（协作模式） | [ ] | `TaskCard.tsx` onClick 事件打开详情弹窗；详情组件调用 `GET /api/tasks/:id` 或复用已有列表数据；`resolve-names` 机制保证名称可读性 |
| V-UI-38 | 在群任务被跨团队 claim 并进入 `pending_authorization` 后，刷新 Tasks 页面 | 该任务卡片仍显示在 Pending 列，状态 badge 显示 `pending_authorization`（或特殊标识） | [ ] | `tasks.ts` / `group-tasks.ts` 状态机：`pending` → `pending_authorization` → `claimed`；看板分栏逻辑按 `status` 归类；验证状态枚举在 UI 中的完整覆盖 |
| V-UI-39 | 授权批准后，刷新 Tasks 页面 | 任务从 Pending 列移到 In Progress 列，状态显示 `claimed` 或后续变为 `running` | [ ] | 授权批准后任务状态流转触发看板重新归类；`TaskBoard.tsx` 按 `status` 过滤分组逻辑；验证 WebSocket 或轮询机制是否实时同步看板 |

---

## 模块六：Chat 页面 — 跨团队上下文（可选）

若群成员在聊天频道中有交互，验证跨团队可见性与 Agent 状态同步。

| # | 操作 | 预期结果 | 状态 | 关联代码 / 设计 |
|---|------|----------|------|----------------|
| V-UI-40 | 进入 Chat 页面，观察右侧成员列表 | 若群任务已授权批准且 Agent 被唤醒，Agent 在线状态应在成员列表中正确显示（机器人图标 + Agent 名称 + awake 状态） | [ ] | `ws/handler.ts` Agent 状态广播（`agent.hello` / `agent.status`）；`MemberList.tsx` 在线成员渲染；联邦 wake 后 Daemon 启动 Agent 进程，状态变为 `awake` 并广播 |
| V-UI-41 | 在群上下文相关的频道中发送消息 | 消息发送者名称正确显示（非 UUID），跨团队成员（若在同一共享频道）应能收到消息 | [ ] | `broadcastToChannel` 消息路由逻辑；`messages.ts` `sender_name` 列持久化；`resolveSenderName` 解析逻辑保证名称可读 |

---

## 验证结果汇总

| 模块 | 总项数 | 通过 | 失败 | 跳过 | 备注 |
|------|--------|------|------|------|------|
| 导航栏与路由 | 6 | | | | |
| Groups 页面 — 群生命周期 | 16 | | | | |
| Authorizations 页面 — 授权闸门 | 6 | | | | |
| Agents 页面 — Agent 标签 | 5 | | | | |
| Tasks 页面 — 群任务看板 | 6 | | | | |
| Chat 页面 — 跨团队上下文 | 2 | | | | |
| **总计** | **41** | | | | |

---

## 签名

- **验证日期：** ___________
- **验证人：** ___________
- **结论：** □ 全部通过  □ 有条件通过（备注：________________）  □ 不通过（需修复后重验）
- **已知问题（如有）：**
  - Agents 页面 "Add Agent" 模态框当前缺少 `labels` 输入字段，创建后需通过 API 补充 labels，方可参与联邦标签匹配。

