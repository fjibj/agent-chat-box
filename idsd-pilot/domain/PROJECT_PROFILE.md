# 项目画像：Agent Chat Box — 域层（Domain）

## 产品定位

Agent Chat Box 是一个跨机器多 Agent 任务调度与协作平台，管理运行在不同机器（家庭电脑、公司电脑、云服务器）上的多种 AI 编程 Agent（Claude Code、Codex、OpenClaw、Hermes），实现跨机调度、任务争抢、协作分解以及人机实时聊天。

组织模型分四层：

```
团队 (Team)   —— 单组织的 Agent 与机器            （已完成）
群 (Group)    —— 多团队协作：契约、授权、信誉、联邦 （已完成）
域 (Domain)   —— 多群聚合的联盟层                  （本次开发）
世界 (World)  —— 跨域联邦                         （未来）
```

域层的定位（依据《用IDSD开发"域"层的实操指南》与联邦网关架构的 Future Considerations）：**为多个群提供一个声誉驱动的联盟层，让群之间能发现彼此的能力而不暴露实现细节，使跨群协作从手动对接变成自动匹配。** 架构上复用联邦 Hub/Runner 协议：群 Hub 作为 Runner 连接到域 Hub，递归复用同一协议。

## 当前阶段

- v0.1.0 核心调度：已完成并人工验证。
- v0.2.0 群扩展 + 联邦网关：已完成，TEA 自动化测试通过，人工验证 A~M 已执行。
- v0.2.0 follow-up stories（G027~G031、F011~F012、Q001）+ 后续补丁：关闭 14 + 7 个 GAP。
- v0.2.0-idsd-gap19：IDSD 试点成功——Holdout Set 8 场景 100% 通过，验证 IDSD 工具链（idsd-harness）可用。
- 质量基线：server 245 / web 45 / 根 76 用例通过；typecheck 干净；lint 0 errors；人工验证 187 通过 / 1 项非阻塞技术债（M8-15 WS claim TODO）。

## 技术栈

- 服务器：Fastify 5 + ws 8 + sql.js 1.11（WASM SQLite，无原生依赖）
- 联邦网关：WebSocket 自定义协议（slock 风格信封），Hub-and-Spoke 星型拓扑，Runner poll 模式
- Daemon：Node.js 20+ + ws + 进程管理 + Agent 适配器（claude / codex / openclaw / hermes）
- 前端：React 19 + Vite 6 + Tailwind CSS 4 + React Router
- 类型：TypeScript strict mode + ESM
- 包管理：npm（monorepo，根目录管理依赖）
- 测试：Vitest 3 + Playwright 1.49 E2E
- 代码检查：ESLint 9 + Prettier 3

## 架构决策（域层必须继承）

| 决策 | 内容 | 出处 |
|---|---|---|
| 模块化单体 | 在现有 Server 内新增模块，不引入微服务 | 群扩展架构 |
| Hub-and-Spoke 联邦 | 仅 Hub 需公网暴露，Runner 反向连接 + poll | 联邦网关架构 |
| 递归复用协议 | 群 Hub 作为 Runner 连接域 Hub，同一联邦信封 | 联邦架构 Future Considerations |
| 统一信封 | `{ v, id, type, ts, [from, to,] data }`，WebSocket 与联邦共用 | packages/shared/src/types.ts |
| 向后兼容 | 现有 API / WS 协议不变，新能力通过扩展实现 | NFR-005 |
| 数据隔离 | Hub 只传索引与元数据，不缓存任务内容 | 联邦架构 |
| 契约 YAML | 群契约以 YAML 字段存储，应用层解析 | 群扩展架构 |
| sql.js | 不引入 PostgreSQL（域层 v1 同样适用） | 群扩展架构 |
| 内存映射 | 成员列表 / 连接映射内存缓存，数据库只做持久化 | 群扩展架构 |

## 通信协议

WebSocket 端点：`/ws`（Web UI）、`/daemon/connect`（Daemon 反向连接）、`/federation`（Hub-Runner）。

消息类型前缀（packages/shared/src/constants.ts）：
- `agent.*` / `message.*` / `task.*` / `channel.*` / `human.*`
- `group.*` / `authorization.*` / `review.*`
- `federation.*`（register / heartbeat / member.joined / member.left / task.broadcast / task.claim / agent.wake）

域层新消息类型预期使用 `domain.*` 前缀，与现有类型并存，保持向后兼容。

## 必须遵守的规则

- TypeScript strict + ESM；禁止 CommonJS `require`。
- 所有代码注释使用英文，与现有代码库保持一致。
- 服务器使用 sql.js：通过 `getDatabase()` 写 SQL，`step()` 后调用 `stmt.free()`。
- WebSocket / 联邦消息使用统一信封结构。
- REST API 错误返回 `{ error: string }` + 合适 HTTP 状态码。
- 前端使用函数式 React 组件 + hooks；状态持久化使用 localStorage。
- 每次变更保持现有测试通过（`npm test`、`npm run typecheck`、`npm run lint`）。
- YAGNI：不引入新基础设施（不用 Redis / PostgreSQL / 新依赖）。
- 危险操作（删除文件、批量修改、改 schema、生产 API 调用）前必须确认。
- IDSD 试点约定：holdout 场景对构建代理不可见（.claudeignore 屏蔽）；Intent 不写实现细节；Expectations 用用户语言。

## 域层可复用模块

服务端（packages/server/src/）：
- `api/groups.ts` + `modules/group-manager.ts` —— 群生命周期、契约、邀请码、成员
- `federation/hub.ts` / `runner.ts` / `protocol.ts` —— 联邦基础设施（域 Hub 直接复用同一套）
- `modules/reputation.ts` —— 信誉分引擎（域级信誉需在群级之上扩展聚合）
- `modules/auth-gate.ts` —— 授权闸门（手动/自动、信誉阈值）
- `federation/label-matcher`（LabelMatcher）—— 标签子集匹配路由
- `modules/wake-engine.ts` —— Agent 唤醒触发
- `modules/task-queue.ts` —— 任务状态机
- `api/channels.ts` / `api/messages.ts` —— 频道与消息
- `db/schema.sql` —— 14 张表（schema v9），域层通过迁移 v9→v10 扩展

前端（packages/web/src/）：
- `pages/GroupsPage.tsx` / `GroupTasksPage.tsx` / `AuthorizationsPage.tsx` —— 群管理/群任务/授权 UI
- `pages/SettingsPage.tsx` —— Federation Peers 面板（域面板可参照）
- `components/ReputationBadge.tsx` / `hooks/useWebSocket.ts` —— 信誉徽章 / WS 连接

## 已知方向线索（供 Intent 阶段参考，非设计决策）

- 域 = 声誉驱动的联盟层：群向域声明能力，域支持跨群能力发现（实操指南切片 2）
- 群 Hub 作为 Runner 连接域 Hub，递归复用联邦协议（联邦架构 Future Considerations）
- 域级信誉在群级信誉之上聚合，跨群协作结果回流（实操指南）
- 远期线索：算力市场 / 跨域任务交易（群扩展架构 Future Considerations）；World = 跨域联邦（CLAUDE.md 下阶段候选）

## 开放问题（需要产品所有者定义，进入 Intent 阶段）

1. 域的最小形态与创建方式：谁创建域？域主如何产生？邀请制是否复用群的做法？
2. 域的信任模型：域级信誉如何从群级聚合？是否引入独立阈值？
3. 能力注册中心：群向域声明什么能力？发现结果的可见性与排序规则？
4. 域与联邦的关系：域 Hub 是否就是"Hub of Hubs"，递归复用 Runner 连接？
5. 数据边界：域内哪些数据可见、哪些隔离？
