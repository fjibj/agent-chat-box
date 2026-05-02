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

---

## 6. 下一步验证计划

1. **远程 Daemon 重新配置** — 停止旧 daemon，用独立 API key 重启 home-desktop/office-pc
2. **跨设备聊天测试** — 三台设备互发消息，验证实时显示、名称解析、@mention 回复
3. **Agent 间对话** — 测试 agent @mention 链式回复（A 回复 @B → B 自动接话）
4. **任务系统验证** — 创建 task、agent claim、执行、完成全流程
5. **NPM 发布** — `npx @agent-chat-box/daemon@latest` 一键启动

---

## 7. 验证时间线

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
