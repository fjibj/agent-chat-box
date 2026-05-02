# Sprint Plan: Agent Chat Box

**Date:** 2026-05-01
**Scrum Master:** Administrator
**Project Level:** 3
**Total Stories:** 35
**Total Points:** 142
**Planned Sprints:** 5
**Team:** 1 senior developer
**Sprint Length:** 2 weeks
**Capacity:** 30 points/sprint

---

## Executive Summary

Agent Chat Box 跨机器多 Agent 任务调度平台，拆解为 35 个用户故事，分布在 5 个 Sprint 中完成。前 3 个 Sprint 交付核心功能（基础设施+聊天+任务），后 2 个 Sprint 完善 Agent 驱动和高级功能。

**关键指标:**
- 总故事数: 35
- 总点数: 142
- Sprint 数: 5
- 团队容量: 30 点/Sprint
- 预计完成: 2026-07-10（10周）

---

## Story Inventory

### EPIC-001: 基础设施 (13 points)

#### STORY-001: 项目骨架搭建

**Epic:** EPIC-001
**Priority:** Must Have
**Points:** 3

**User Story:**
As a developer, I want a working monorepo with shared types, so that all packages can communicate with type safety.

**Acceptance Criteria:**
- [ ] pnpm workspace 配置完成
- [ ] packages/shared 导出协议类型（WSMessage, Task, Agent, Channel 等）
- [ ] tsconfig.json strict mode
- [ ] ESLint + Prettier 配置
- [ ] `pnpm install && pnpm build` 成功

**Technical Notes:**
- 参考 slock-clone 的 packages/protocol
- 类型定义参考 design-spec.md 协议设计部分

**Dependencies:** 无

---

#### STORY-002: 数据库 Schema 初始化

**Epic:** EPIC-001
**Priority:** Must Have
**Points:** 3

**User Story:**
As a developer, I want the SQLite database schema, so that the server can persist all data.

**Acceptance Criteria:**
- [ ] better-sqlite3 集成
- [ ] 所有表创建：machines, agents, channels, channel_members, messages, tasks
- [ ] 索引创建
- [ ] FTS5 虚拟表（消息全文搜索）
- [ ] 迁移机制（版本管理）

**Technical Notes:**
- Schema 参考 architecture-agent-chat-box 数据库设计部分
- WAL 模式启用

**Dependencies:** STORY-001

---

#### STORY-003: Fastify HTTP 服务器基础

**Epic:** EPIC-001
**Priority:** Must Have
**Points:** 3

**User Story:**
As a developer, I want a running HTTP server, so that the API and WebSocket can be accessed.

**Acceptance Criteria:**
- [ ] Fastify 服务器启动，监听端口 3000
- [ ] CORS 配置
- [ ] 静态文件服务（Web UI build）
- [ ] GET /api/version 返回版本号
- [ ] 错误处理中间件

**Technical Notes:**
- 端口可配置
- 开发模式支持 Vite proxy

**Dependencies:** STORY-001

---

#### STORY-004: WebSocket 服务器基础

**Epic:** EPIC-001
**Priority:** Must Have
**Points:** 5

**User Story:**
As a developer, I want WebSocket endpoints for humans and daemons, so that real-time communication works.

**Acceptance Criteria:**
- [ ] /ws 端点（人类客户端）
- [ ] /daemon/connect 端点（Daemon）
- [ ] 消息信封解析（v, id, type, ts, data）
- [ ] ping/pong 心跳（30s/10s）
- [ ] 连接管理和清理

**Technical Notes:**
- 使用 ws 库
- 两种端点分别处理
- 参考 slock-clone 的 WebSocket 实现

**Dependencies:** STORY-003

---

### EPIC-002: Agent 生命周期 (15 points)

#### STORY-005: 机器注册与认证

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want to register machines with API keys, so that daemons can authenticate when connecting.

**Acceptance Criteria:**
- [ ] POST /api/machines 创建机器，返回 API Key
- [ ] API Key 格式：`sk_` + 随机字符串
- [ ] API Key 存储为 scrypt 哈希
- [ ] GET /api/machines 列表
- [ ] DELETE /api/machines/:id 删除
- [ ] Daemon 通过 machine.auth 消息认证

**Technical Notes:**
- API Key 只在创建时返回一次
- scrypt 使用 Node.js crypto 模块

**Dependencies:** STORY-002, STORY-004

---

#### STORY-006: Daemon 自动重连

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 3

**User Story:**
As a user, I want daemons to automatically reconnect when disconnected, so that machines stay connected despite network issues.

**Acceptance Criteria:**
- [ ] WebSocket 断线后自动重连
- [ ] 指数退避：1s → 2s → 4s → 8s → 16s → 30s
- [ ] 重连后重新认证
- [ ] 重连后重新注册所有 Agent
- [ ] 连接状态日志

**Technical Notes:**
- 参考 zouk-daemon 的重连实现
- 重连成功后重置退避计数

**Dependencies:** STORY-005

---

#### STORY-007: 运行时检测

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 3

**User Story:**
As a user, I want the daemon to detect which agent CLIs are installed, so that the server knows available runtimes.

**Acceptance Criteria:**
- [ ] 检测 claude, codex, openclaw, hermes 二进制
- [ ] 获取版本号
- [ ] 检测结果报告给服务器
- [ ] 检测失败不阻断启动
- [ ] 定期重新检测（可选）

**Technical Notes:**
- 使用 child_process.exec 执行 `which` + `--version`
- 检测超时 5 秒

**Dependencies:** STORY-006

---

#### STORY-008: Agent 注册与身份管理

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want to create agents with names and identities, so that they appear as team members.

**Acceptance Criteria:**
- [ ] POST /api/agents 创建 Agent
- [ ] Agent 属性：name, runtime, description, capabilities
- [ ] agent.hello 消息注册，携带 role_card
- [ ] agent.welcome 返回订阅列表和上下文
- [ ] GET /api/agents 列表
- [ ] PATCH /api/agents/:id 更新
- [ ] DELETE /api/agents/:id 删除

**Technical Notes:**
- role_card 格式：{ name, avatar, description, system_prompt }
- Agent 必须属于某台机器

**Dependencies:** STORY-005, STORY-007

---

### EPIC-003: 聊天系统 (25 points)

#### STORY-009: 频道 CRUD

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 3

**User Story:**
As a user, I want to create and manage channels, so that conversations are organized.

**Acceptance Criteria:**
- [ ] POST /api/channels 创建频道
- [ ] GET /api/channels 列表
- [ ] GET /api/channels/:id 详情
- [ ] DELETE /api/channels/:id 删除
- [ ] channel.create WebSocket 消息
- [ ] 默认 #general 频道自动创建

**Technical Notes:**
- 频道类型：group, dm, task
- 创建者自动加入

**Dependencies:** STORY-002, STORY-004

---

#### STORY-010: 频道成员管理

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 3

**User Story:**
As a user, I want to add/remove members from channels, so that the right people and agents are in each conversation.

**Acceptance Criteria:**
- [ ] 频道创建时自动添加创建者
- [ ] Agent 注册时自动加入默认频道
- [ ] channel.subscribe 订阅消息
- [ ] channel.subscribed 返回成员列表
- [ ] 成员列表可查询

**Technical Notes:**
- member_kind: human / agent
- 订阅关系存储在 channel_members 表

**Dependencies:** STORY-009, STORY-008

---

#### STORY-011: 消息发送与接收

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want to send and receive messages in real-time, so that I can communicate with agents.

**Acceptance Criteria:**
- [ ] message.send 发送消息
- [ ] message.ack 确认消息
- [ ] message.new 广播给频道订阅者
- [ ] 消息持久化到数据库
- [ ] 消息包含 sender_kind 标识
- [ ] 支持 reply_to 回复

**Technical Notes:**
- 消息格式：{ id, channel_id, sender_id, sender_kind, content, mentions, reply_to, ts }
- 实时推送给所有在线订阅者

**Dependencies:** STORY-010

---

#### STORY-012: @mention 触发

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want to @mention agents to wake them up, so that I can get their attention.

**Acceptance Criteria:**
- [ ] 消息中 @name 解析为 mention
- [ ] 被 @mention 的 Agent 收到消息
- [ ] 如果 Agent 在 SLEEPING，触发 agent.wake
- [ ] agent.wake 携带最近 10 条消息作为上下文
- [ ] Agent 收到 wake 后转为 AWAKE

**Technical Notes:**
- MsgRouter.checkMentions() 解析 @name
- 参考 slock-clone 的 Sleep/Wake 协议

**Dependencies:** STORY-011, STORY-016

---

#### STORY-013: 历史消息加载

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 3

**User Story:**
As a user, I want to load message history, so that I can see past conversations.

**Acceptance Criteria:**
- [ ] GET /api/channels/:id/messages 分页查询
- [ ] 支持 before/after 游标
- [ ] 默认返回最新 50 条
- [ ] 消息按时间排序
- [ ] 包含发送者信息

**Technical Notes:**
- 使用 created_at 作为游标
- FTS5 全文搜索可选

**Dependencies:** STORY-011

---

#### STORY-014: 私信（DM）

**Epic:** EPIC-003
**Priority:** Should Have
**Points:** 3

**User Story:**
As a user, I want to send direct messages to agents, so that I can have private conversations.

**Acceptance Criteria:**
- [ ] 创建 DM 频道（type=dm）
- [ ] DM 只对双方可见
- [ ] DM 中自动 @mention 对方
- [ ] DM 列表单独显示

**Technical Notes:**
- DM 频道名：dm:@user:@agent
- 两个成员自动添加

**Dependencies:** STORY-009, STORY-011

---

#### STORY-015: 文件附件

**Epic:** EPIC-003
**Priority:** Should Have
**Points:** 3

**User Story:**
As a user, I want to attach files to messages, so that I can share code and documents.

**Acceptance Criteria:**
- [ ] POST /api/uploads 上传文件
- [ ] 文件存储到 data/uploads/
- [ ] GET /api/uploads/:id 下载
- [ ] 消息中包含 attachments 数组
- [ ] 图片内联渲染
- [ ] 文件大小限制 10MB

**Technical Notes:**
- 使用 multipart/form-data
- 文件 ID 格式：up_xxx

**Dependencies:** STORY-011

---

### EPIC-004: 任务系统 (40 points)

#### STORY-016: Agent Sleep/Wake 引擎

**Epic:** EPIC-004
**Priority:** Must Have
**Points:** 5

**User Story:**
As an agent, I want to sleep when idle and be woken when needed, so that I don't waste resources.

**Acceptance Criteria:**
- [ ] agent.sleep 进入休眠
- [ ] agent.wake 唤醒，携带上下文
- [ ] wake 触发条件：@mention, DM, task assignment
- [ ] 上下文包含最近消息 + 线程
- [ ] 断线重连后 context_window 补发

**Technical Notes:**
- 状态机：AWAKE → SLEEPING → AWAKE
- 参考 slock-clone 的 Sleep/Wake 实现

**Dependencies:** STORY-012

---

#### STORY-017: 任务创建与发布

**Epic:** EPIC-004
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want to create tasks and publish them to channels, so that agents can see and claim them.

**Acceptance Criteria:**
- [ ] task.create 创建任务
- [ ] 任务属性：title, description, priority, mode, tags
- [ ] 模式：compete（争抢）、collaborate（协作）
- [ ] 任务广播到频道
- [ ] task.created 通知所有订阅者
- [ ] 状态机：pending → claimed → running → completed / failed

**Technical Notes:**
- 任务创建后状态为 pending
- 优先级：low/normal/high/urgent

**Dependencies:** STORY-011

---

#### STORY-018: 任务争抢（Compete 模式）

**Epic:** EPIC-004
**Priority:** Must Have
**Points:** 8

**User Story:**
As an agent, I want to compete for tasks, so that I can get work to do.

**Acceptance Criteria:**
- [ ] task.claim 争抢任务
- [ ] SQLite 事务保证原子性
- [ ] 先 claim 先得
- [ ] claim 成功广播 task.claimed
- [ ] claim 失败返回错误
- [ ] 争抢响应时间 <2s

**Technical Notes:**
```sql
BEGIN IMMEDIATE;
UPDATE tasks SET status='claimed', assignee_id=?, claimed_at=?
WHERE id=? AND status='pending';
-- affected_rows = 0 → 已被他人 claim
COMMIT;
```

**Dependencies:** STORY-017

---

#### STORY-019: 任务执行回报

**Epic:** EPIC-004
**Priority:** Must Have
**Points:** 5

**User Story:**
As an agent, I want to report task progress and completion, so that users can track my work.

**Acceptance Criteria:**
- [ ] task.update 更新进度
- [ ] task.completed 完成任务
- [ ] task.failed 失败报告
- [ ] 进度消息广播到频道
- [ ] 完成后 Agent 可回到 SLEEPING

**Technical Notes:**
- 进度格式：{ progress: 0-100, message: "..." }
- 完成后记录 output

**Dependencies:** STORY-018

---

#### STORY-020: 任务协作（Collaborate 模式）

**Epic:** EPIC-004
**Priority:** Must Have
**Points:** 8

**User Story:**
As a user, I want to decompose big tasks into subtasks for multiple agents, so that complex work can be done in parallel.

**Acceptance Criteria:**
- [ ] task.subtasks 创建子任务
- [ ] 子任务可指定 assignee 或留空
- [ ] 子任务独立跟踪状态
- [ ] 所有子任务完成后主任务自动 completed
- [ ] 主任务显示子任务进度（x/y 完成）

**Technical Notes:**
- parent_task_id 关联主子任务
- 完成检查：SELECT COUNT(*) FROM tasks WHERE parent_task_id=? AND status != 'completed'

**Dependencies:** STORY-018, STORY-019

---

#### STORY-021: 任务超时与重试

**Epic:** EPIC-004
**Priority:** Should Have
**Points:** 5

**User Story:**
As a user, I want tasks to timeout if not completed, so that stuck tasks don't block the queue.

**Acceptance Criteria:**
- [ ] 任务可设置 timeout_seconds
- [ ] 定时检查超时任务（每 10s）
- [ ] 超时后状态变为 failed
- [ ] 可配置 max_retries
- [ ] 重试时重置为 pending

**Technical Notes:**
- 超时检查：claimed_at + timeout_seconds < now
- 重试计数：retry_count < max_retries

**Dependencies:** STORY-019

---

#### STORY-022: Agent 能力匹配

**Epic:** EPIC-004
**Priority:** Should Have
**Points:** 3

**User Story:**
As a user, I want tasks to only be claimable by agents with matching capabilities, so that the right agent does the right work.

**Acceptance Criteria:**
- [ ] 任务可设置 required_capabilities
- [ ] Agent 声明自己的 capabilities
- [ ] claim 时校验能力匹配
- [ ] 不匹配返回错误

**Technical Notes:**
- 匹配逻辑：required_capabilities ⊆ agent.capabilities
- 空 required_capabilities = 任何 Agent 可 claim

**Dependencies:** STORY-018

---

#### STORY-023: 任务时间线

**Epic:** EPIC-004
**Priority:** Could Have
**Points:** 3

**User Story:**
As a user, I want to see a task's timeline, so that I can track its full history.

**Acceptance Criteria:**
- [ ] GET /api/tasks/:id/timeline
- [ ] 记录：创建、claim、进度更新、完成/失败
- [ ] 关联的频道讨论
- [ ] 时间线可导出

**Technical Notes:**
- 独立 timeline 表或从 messages/tasks 联合查询

**Dependencies:** STORY-019

---

### EPIC-005: Agent 驱动 (22 points)

#### STORY-024: Agent 驱动基类

**Epic:** EPIC-005
**Priority:** Must Have
**Points:** 3

**User Story:**
As a developer, I want a base agent driver class, so that all drivers follow the same interface.

**Acceptance Criteria:**
- [ ] BaseAgentDriver 抽象类
- [ ] 接口：detect(), start(), stop()
- [ ] AgentProcess 接口：onOutput, onComplete, onError
- [ ] 自动注册机制
- [ ] 错误处理基类

**Technical Notes:**
- 参考 architecture-agent-chat-box Agent Driver 部分
- 所有驱动继承 BaseAgentDriver

**Dependencies:** STORY-001

---

#### STORY-025: Claude Code 驱动

**Epic:** EPIC-005
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want Claude Code to execute tasks, so that I can use Claude for coding.

**Acceptance Criteria:**
- [ ] 检测 claude CLI
- [ ] 启动：claude --print --output-format stream-json
- [ ] 解析流式 JSON 输出
- [ ] 任务上下文作为 prompt 传入
- [ ] 错误处理和超时

**Technical Notes:**
- stream-json 格式逐行解析
- 使用 child_process.spawn

**Dependencies:** STORY-024

---

#### STORY-026: Codex 驱动

**Epic:** EPIC-005
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want Codex to execute tasks, so that I can use OpenAI's coding agent.

**Acceptance Criteria:**
- [ ] 检测 codex CLI
- [ ] 启动：codex --quiet
[ ] 解析 stdout 输出
- [ ] 任务上下文传入
- [ ] 错误处理

**Technical Notes:**
- 需要 OPENAI_API_KEY 环境变量
- 进程级隔离

**Dependencies:** STORY-024

---

#### STORY-027: OpenClaw 驱动

**Epic:** EPIC-005
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want OpenClaw to execute tasks, so that I can use this coding agent.

**Acceptance Criteria:**
- [ ] 检测 openclaw CLI
- [ ] 适配其通信协议
- [ ] 解析输出
- [ ] 错误处理

**Technical Notes:**
- 需调研 OpenClaw CLI 接口
- 可能需要适配不同版本

**Dependencies:** STORY-024

---

#### STORY-028: Hermes 驱动

**Epic:** EPIC-005
**Priority:** Must Have
**Points:** 5

**User Story:**
As a user, I want Hermes to execute tasks, so that I can use this coding agent.

**Acceptance Criteria:**
- [ ] 检测 hermes CLI
- [ ] 适配其通信协议
- [ ] 解析输出
- [ ] 错误处理

**Technical Notes:**
- 需调研 Hermes CLI 接口
- 可能需要适配不同版本

**Dependencies:** STORY-024

---

#### STORY-029: 进程管理器

**Epic:** EPIC-005
**Priority:** Must Have
**Points:** 5

**User Story:**
As a daemon, I want to manage agent processes, so that tasks are executed reliably.

**Acceptance Criteria:**
- [ ] spawn 子进程
- [ ] 流式输出捕获
- [ ] 进程状态跟踪
- [ ] 超时强制终止
- [ ] crash recovery
- [ ] 同时运行多个 Agent 进程

**Technical Notes:**
- child_process.spawn
- 进程 ID 跟踪
- SIGTERM → SIGKILL 优雅关闭

**Dependencies:** STORY-024

---

### EPIC-006: Web 管理界面 (35 points)

#### STORY-030: Web UI 基础框架

**Epic:** EPIC-006
**Priority:** Must Have
**Points:** 3

**User Story:**
As a user, I want a web interface, so that I can manage the platform from a browser.

**Acceptance Criteria:**
- [ ] React + Vite + Tailwind 项目搭建
- [ ] WebSocket 连接 hook
- [ ] 路由配置
- [ ] 全局状态管理
- [ ] 深色主题

**Technical Notes:**
- Vite dev server proxy 到 :3000
- Tailwind dark mode

**Dependencies:** STORY-003

---

#### STORY-031: 聊天界面

**Epic:** EPIC-006
**Priority:** Must Have
**Points:** 8

**User Story:**
As a user, I want a chat interface, so that I can talk to agents.

**Acceptance Criteria:**
- [ ] 频道列表（左侧栏）
- [ ] 消息流（主区域）
- [ ] 消息输入框
- [ ] 成员列表（右侧栏）
- [ ] @mention 自动补全
- [ ] 消息气泡区分 human/agent
- [ ] 实时新消息滚动

**Technical Notes:**
- 参考 slock-clone 的 Web UI
- 简洁大气风格

**Dependencies:** STORY-030, STORY-011

---

#### STORY-032: 任务看板

**Epic:** EPIC-006
**Priority:** Must Have
**Points:** 8

**User Story:**
As a user, I want a task board, so that I can see all tasks and their status.

**Acceptance Criteria:**
- [ ] 三列看板：待领取 / 进行中 / 已完成
- [ ] 任务卡片：标题、优先级、Agent、进度
- [ ] 筛选：优先级、标签、Agent
- [ ] 搜索
- [ ] 点击查看详情
- [ ] 创建任务按钮

**Technical Notes:**
- 拖拽排序可选
- 实时更新

**Dependencies:** STORY-030, STORY-017

---

#### STORY-033: Agent 管理面板

**Epic:** EPIC-006
**Priority:** Must Have
**Points:** 8

**User Story:**
As a user, I want an agent management panel, so that I can see and manage all machines and agents.

**Acceptance Criteria:**
- [ ] 机器列表：名称、IP、状态、运行时
- [ ] Agent 列表：名称、状态、当前任务
- [ ] 创建 Agent 表单
- [ ] 编辑 Agent
- [ ] 删除 Agent
- [ ] 复制 Daemon 连接命令

**Technical Notes:**
- 机器状态实时更新
- 运行时检测结果显示

**Dependencies:** STORY-030, STORY-008

---

#### STORY-034: 设置页面

**Epic:** EPIC-006
**Priority:** Should Have
**Points:** 3

**User Story:**
As a user, I want a settings page, so that I can configure the server and see connection info.

**Acceptance Criteria:**
- [ ] 服务器信息（地址、端口）
- [ ] Daemon 连接命令（可复制）
- [ ] API Key 管理
- [ ] 数据库路径

**Technical Notes:**
- 只读设置为主
- 复制按钮

**Dependencies:** STORY-030

---

#### STORY-035: 浏览器通知

**Epic:** EPIC-006
**Priority:** Should Have
**Points:** 3

**User Story:**
As a user, I want browser notifications, so that I know when tasks complete or I'm mentioned.

**Acceptance Criteria:**
- [ ] 请求通知权限
- [ ] 任务完成通知
- [ ] @mention 通知
- [ ] 通知点击跳转

**Technical Notes:**
- Notification API
- 仅在页面非活跃时推送

**Dependencies:** STORY-031

---

## Sprint Allocation

### Sprint 1 (Weeks 1-2) — 基础骨架 + 聊天核心

**Goal:** 跑通服务器 → Daemon → 聊天消息流

**Stories:**
| ID | Title | Points | Priority |
|----|-------|--------|----------|
| STORY-001 | 项目骨架搭建 | 3 | Must |
| STORY-002 | 数据库 Schema | 3 | Must |
| STORY-003 | Fastify HTTP 服务器 | 3 | Must |
| STORY-004 | WebSocket 服务器 | 5 | Must |
| STORY-005 | 机器注册与认证 | 5 | Must |
| STORY-009 | 频道 CRUD | 3 | Must |
| STORY-010 | 频道成员管理 | 3 | Must |
| STORY-011 | 消息发送与接收 | 5 | Must |

**Total:** 30/30 points (100%)

**Sprint 结束时可演示:**
- 服务器启动，数据库初始化
- Daemon 连接服务器，检测运行时
- 创建频道，发送消息，实时接收

---

### Sprint 2 (Weeks 3-4) — Agent 生命周期 + 聊天完善

**Goal:** Agent 注册、Sleep/Wake、@mention、历史消息

**Stories:**
| ID | Title | Points | Priority |
|----|-------|--------|----------|
| STORY-006 | Daemon 自动重连 | 3 | Must |
| STORY-007 | 运行时检测 | 3 | Must |
| STORY-008 | Agent 注册与身份管理 | 5 | Must |
| STORY-012 | @mention 触发 | 5 | Must |
| STORY-013 | 历史消息加载 | 3 | Must |
| STORY-016 | Agent Sleep/Wake 引擎 | 5 | Must |
| STORY-014 | 私信（DM） | 3 | Should |
| STORY-024 | Agent 驱动基类 | 3 | Must |

**Total:** 30/30 points (100%)

**Sprint 结束时可演示:**
- Daemon 断线自动重连
- Agent 注册，显示在管理面板
- @mention 唤醒 Agent
- Agent 空闲时 sleep，被需要时 wake

---

### Sprint 3 (Weeks 5-6) — 任务系统核心

**Goal:** 任务创建、争抢、执行、完成

**Stories:**
| ID | Title | Points | Priority |
|----|-------|--------|----------|
| STORY-017 | 任务创建与发布 | 5 | Must |
| STORY-018 | 任务争抢 | 8 | Must |
| STORY-019 | 任务执行回报 | 5 | Must |
| STORY-020 | 任务协作 | 8 | Must |
| STORY-025 | Claude Code 驱动 | 5 | Must |

**Total:** 31/30 points (103% — 轻微超载，可接受)

**Sprint 结束时可演示:**
- 创建任务，Agent 争抢 claim
- Claude Code 执行任务，流式输出
- 大任务分解为子任务，多 Agent 协作

---

### Sprint 4 (Weeks 7-8) — Agent 驱动 + 任务完善

**Goal:** 完成所有 Agent 驱动，任务超时/重试/能力匹配

**Stories:**
| ID | Title | Points | Priority |
|----|-------|--------|----------|
| STORY-026 | Codex 驱动 | 5 | Must |
| STORY-027 | OpenClaw 驱动 | 5 | Must |
| STORY-028 | Hermes 驱动 | 5 | Must |
| STORY-029 | 进程管理器 | 5 | Must |
| STORY-021 | 任务超时与重试 | 5 | Should |
| STORY-022 | Agent 能力匹配 | 3 | Should |
| STORY-015 | 文件附件 | 3 | Should |

**Total:** 31/30 points (103% — 轻微超载)

**Sprint 结束时可演示:**
- 4 种 Agent 全部可用
- 任务超时自动释放
- 能力匹配：特定任务只给匹配的 Agent
- 文件附件上传下载

---

### Sprint 5 (Weeks 9-10) — Web UI + 收尾

**Goal:** 完整 Web 管理界面，通知，时间线

**Stories:**
| ID | Title | Points | Priority |
|----|-------|--------|----------|
| STORY-030 | Web UI 基础框架 | 3 | Must |
| STORY-031 | 聊天界面 | 8 | Must |
| STORY-032 | 任务看板 | 8 | Must |
| STORY-033 | Agent 管理面板 | 8 | Must |
| STORY-034 | 设置页面 | 3 | Should |
| STORY-035 | 浏览器通知 | 3 | Should |
| STORY-023 | 任务时间线 | 3 | Could |

**Total:** 36/30 points (120% — 超载，STORY-023 可推迟)

**Sprint 结束时可演示:**
- 完整 Web 管理界面
- 聊天、任务看板、Agent 管理
- 浏览器通知

**注:** Sprint 5 超载，STORY-023（任务时间线）可推迟到后续迭代。

---

## Epic Traceability

| Epic | Stories | Total Points | Sprints |
|------|---------|--------------|---------|
| EPIC-001 基础设施 | STORY-001~004 | 14 | Sprint 1 |
| EPIC-002 Agent 生命周期 | STORY-005~008 | 16 | Sprint 1-2 |
| EPIC-003 聊天系统 | STORY-009~015 | 25 | Sprint 1-2 |
| EPIC-004 任务系统 | STORY-016~023 | 37 | Sprint 2-3 |
| EPIC-005 Agent 驱动 | STORY-024~029 | 28 | Sprint 2-4 |
| EPIC-006 Web UI | STORY-030~035 | 33 | Sprint 5 |
| **Total** | **35 stories** | **142 points** | **5 sprints** |

---

## Requirements Coverage

| FR | Name | Story | Sprint |
|----|------|-------|--------|
| FR-001 | 机器注册 | STORY-005 | 1 |
| FR-002 | 运行时检测 | STORY-007 | 2 |
| FR-003 | Agent 注册 | STORY-008 | 2 |
| FR-004 | 频道消息 | STORY-009~011 | 1 |
| FR-005 | Sleep/Wake | STORY-016 | 2 |
| FR-006 | 任务创建 | STORY-017 | 3 |
| FR-007 | 任务争抢 | STORY-018 | 3 |
| FR-008 | 任务协作 | STORY-020 | 3 |
| FR-009 | 任务执行 | STORY-025~029 | 3-4 |
| FR-010 | 任务看板 | STORY-032 | 5 |
| FR-011 | Agent 管理 | STORY-033 | 5 |
| FR-012 | 私信 | STORY-014 | 2 |
| FR-013 | 文件附件 | STORY-015 | 4 |
| FR-014 | 通知 | STORY-035 | 5 |
| FR-015 | 超时重试 | STORY-021 | 4 |
| FR-016 | 能力匹配 | STORY-022 | 4 |
| FR-017 | 多 Workspace | - | 未排期 |
| FR-018 | 任务时间线 | STORY-023 | 5 (可推迟) |

---

## Risks

**High:**
- OpenClaw/Hermes CLI 接口不确定 — 缓解：Sprint 4 前调研
- Sprint 5 超载 — 缓解：STORY-023 推迟到后续迭代

**Medium:**
- SQLite 并发写入 — 缓解：WAL 模式 + 写入队列
- Daemon 进程稳定性 — 缓解：crash recovery

**Low:**
- 浏览器兼容性 — 缓解：主流浏览器测试

---

## Definition of Done

- [ ] 代码实现并提交
- [ ] 单元测试通过（覆盖率 >60%）
- [ ] TypeScript 编译无错误
- [ ] 功能手动验证
- [ ] 相关文档更新

---

## Next Steps

**立即开始 Sprint 1:**

```
Sprint 1 目标：跑通服务器 → Daemon → 聊天消息流
```

运行 `/dev-story STORY-001` 开始第一个故事。

---

**This plan was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
