# Agent Chat Box 竞品深度对比分析

**日期:** 2026-05-05
**作者:** Cola (AI Assistant)
**基于:** `docs/research-comparative-analysis.md` + agent-chat-box v0.1.0 源码分析 + 竞品公开信息

---

## 一、分析范围

| 项目 | 定位 | 开源 | 备注 |
|------|------|------|------|
| **agent-chat-box** | 跨机多Agent任务调度与协作平台 | ✅ MIT | 本项目，v0.1.0 |
| **slock.ai** | Agent协作聊天平台 | ✅ MIT (clone) | 协议设计参考源 |
| **Multica** | 管理型Agent平台 | ✅ 开源 | 跨机Daemon参考 |
| **MaClaw** | 通用自进化智能体 | ⚠️ Dual License | Swarm编排概念 |
| **AgentNet** | P2P Agent基础设施 | ❌ 协议层 | DAG编排参考 |
| **Crewden** | 最小化Agent工作空间 | ✅ 开源 | slock+Multica混合体 |
| **Claude Squad** | 本地多Agent终端管理 | ✅ AGPL | 单机方案 |
| **OpenHands** | AI软件开发平台 | ✅ MIT | 单Agent方案 |
| **zouk-daemon** | 机器端守护进程 | ❌ Proprietary | Daemon参考 |
| **AgentsZone** | Tauri桌面Agent协作 | ❌ Private | 上下文编排参考 |

---

## 二、核心能力对比矩阵

### 2.1 功能维度

| 能力维度 | agent-chat-box | slock.ai | Multica | MaClaw | AgentNet | Crewden | Claude Squad |
|---|---|---|---|---|---|---|---|
| **跨机部署** | ✅ Daemon反向连接，Tailscale组网验证通过 | ❌ 单服务器 | ✅ Daemon反向连接 | ⚠️ 实验性AgentNet | ✅ P2P协议 | ✅ Daemon | ❌ 单机 |
| **任务竞争模式** | ✅ 原子claim + 随机延迟2-6s公平竞争 | ✅ 基础claim | ❌ 仅指派制 | ⚠️ Swarm编排 | ✅ Board争抢 | ❌ 无 | ❌ 手动分配 |
| **任务指派模式** | ✅ 指定Agent，跳过竞争 | ❌ 无 | ✅ 指派制 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 手动 |
| **任务协作模式** | ✅ 递归拆分 + Agent验证 + 失败重拆 | ❌ 无 | ❌ 无 | ✅ Swarm拆分 | ✅ DAG编排 | ❌ 无 | ❌ 无 |
| **Agent实时聊天** | ✅ @mention + 频道 + Sleep/Wake | ✅ 核心能力 | ⚠️ Issue评论 | ✅ IM通道 | ⚠️ 跨节点 | ❌ 消息桥接 | ❌ 无 |
| **Sleep/Wake机制** | ✅ 服务端唤醒 + 携带上下文 | ✅ 精良设计 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| **Human-in-the-loop** | ✅ force-complete/force-fail任意层级 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| **任务树可视化** | ✅ 层级结构 + BFS查询 + 状态图标 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| **文件附件** | ❌ 未实现 | ✅ 上传/图片内联 | — | — | — | — | — |
| **全文搜索** | ❌ sql.js WASM不支持FTS5 | ✅ SQLite FTS5 | ✅ pgvector向量 | ✅ BM25+向量 | — | — | — |
| **多Workspace** | ❌ 未实现（MVP范围外） | ✅ 支持 | ✅ 支持 | — | — | — | — |
| **独立CLI工具** | ❌ 无 | ✅ 完整slock CLI | ✅ CLI | ✅ CLI | ✅ anet CLI | ❌ | ✅ CLI |
| **技能系统** | ❌ 无 | ❌ 无 | ✅ 可复用技能 | ✅ 三源市场 | ❌ 无 | ❌ 无 | ❌ 无 |
| **记忆系统** | ❌ 无 | ❌ 无 | ❌ 无 | ✅ 长期记忆+知识图谱 | ❌ 无 | ❌ 无 | ❌ 无 |
| **Docker部署** | ❌ 无Dockerfile | — | ✅ Docker Compose | — | — | — | — |

### 2.2 架构维度

| 维度 | agent-chat-box | slock.ai | Multica | MaClaw |
|---|---|---|---|---|
| **服务端框架** | Fastify + ws | 无框架 http + ws | Go (Chi) | Go (Wails) |
| **数据库** | SQLite (sql.js WASM) | SQLite (better-sqlite3) | PostgreSQL + pgvector | SQLite + 向量 |
| **Daemon语言** | Node.js + WebSocket | ❌ 无Daemon | Go Agent Daemon | ❌ 单机 |
| **前端** | React 19 + Vite 6 + Tailwind 4 | Web (slock-clone) | Next.js | Wails GUI/TUI |
| **包管理** | pnpm workspace | — | Go modules | Go modules |
| **TypeScript** | strict mode | — | Go + TS | Go + React |
| **测试** | 75用例 (Vitest) | — | — | — |
| **Agent驱动** | Claude/Codex/OpenClaw/Hermes | Agent CLI | 10种CLI | Claude/Codex/Gemini/Kimi |
| **已验证驱动** | Claude ⚠️ Codex | — | — | — |

---

## 三、重点竞品逐项分析

### 3.1 agent-chat-box vs slock.ai

**关系说明**：agent-chat-box 的协议设计（消息信封、Sleep/Wake、task claim）直接继承自 slock.ai。

| 对比维度 | agent-chat-box | slock.ai | 评估 |
|---|---|---|---|
| **协议设计** | 继承slock，扩展了 assign/collaborate/decomposing/verifying 状态 | 原始设计，精良 | 🤝 持平——继承但未被破坏 |
| **Sleep/Wake** | 同slock实现 | 精良设计 | 🤝 持平 |
| **任务claim** | 原子事务 + 能力匹配 + 随机延迟2-6s | 基础claim | ✅ agent-chat-box 更好 |
| **任务模式** | 竞争/指派/协作 三种 | 仅竞争 | ✅ agent-chat-box 更好 |
| **跨机** | Daemon反向连接，Tailscale验证 | 单服务器 | ✅ agent-chat-box 更好 |
| **文件附件** | ❌ 未实现 | ✅ 支持上传/图片渲染 | ❌ 不如 slock |
| **全文搜索** | ❌ sql.js不支持FTS5 | ✅ SQLite FTS5 | ❌ 不如 slock |
| **多Workspace** | ❌ 未实现 | ✅ 支持 | ❌ 不如 slock |
| **CLI工具** | ❌ 无 | ✅ 完整slock CLI | ❌ 不如 slock |
| **生产成熟度** | 自用验证，33个bug已修复 | 有真实用户基础 | ❌ 不如 slock |

**核心差异**：agent-chat-box 在 slock 基础上增加了跨机能力和协作模式，但在产品完整度（附件、搜索、CLI、Workspace）上落后。

---

### 3.2 agent-chat-box vs Multica

| 对比维度 | agent-chat-box | Multica | 评估 |
|---|---|---|---|
| **跨机Daemon** | ✅ Node.js Daemon + 自动重连 | ✅ Go Daemon | 🤝 持平 |
| **Agent驱动数量** | 4种（2种实际验证） | 10种CLI | ❌ 不如 Multica |
| **任务争抢** | ✅ 核心能力 | ❌ 仅指派制 | ✅ agent-chat-box 更好 |
| **Agent实时聊天** | ✅ 频道 + @mention + Sleep/Wake | ⚠️ Issue评论（非实时聊） | ✅ agent-chat-box 更好 |
| **任务协作拆分** | ✅ 递归拆分 + 验证 + 重新拆 | ❌ 无 | ✅ agent-chat-box 更好 |
| **技能系统** | ❌ 无 | ✅ 可复用技能 | ❌ 不如 Multica |
| **Docker部署** | ❌ 无Dockerfile | ✅ Docker支持 | ❌ 不如 Multica |
| **多Workspace** | ❌ 单workspace | ✅ 多Workspace | ❌ 不如 Multica |
| **前端成熟度** | React SPA | Next.js全栈 | ❌ 不如 Multica |

**核心差异**：Multica 更像产品（Docker、技能系统、10种Agent），agent-chat-box 更像精悍工具（争抢+协作+聊天核心更深）。

---

### 3.3 agent-chat-box vs MaClaw / AgentNet（协作模式专项对比）

| 维度 | agent-chat-box | MaClaw | AgentNet |
|---|---|---|---|
| **拆分方式** | Agent自动评估复杂度 + JSON输出 | 结构化工作流模板(19种) | DAG节点定义 |
| **拆分粒度** | 递归拆分，最大深度3层 | Swarm并行执行 | 任意DAG拓扑 |
| **验证机制** | ✅ Agent验证 + 失败重新拆 | ❌ 无验证环节 | ❌ 依赖DAG执行状态 |
| **子任务分配** | 竞争/指派混合，动态判定 | 固定模板分配 | DAG节点指定 |
| **成熟度** | 自用验证通过 | 功能最多但偏单体 | 协议层设计 |
| **跨机** | ✅ 已验证 | ⚠️ 实验性 | ✅ P2P |

**核心差异**：agent-chat-box 的协作模式比 MaClaw 更灵活（Agent自主决定拆法），比 AgentNet 更简洁（两层嵌套+验证）。但 MaClaw 的记忆系统和 AgentNet 的 DAG 通用性各有优势。

---

## 四、综合能力评估

### 4.1 文字雷达图（5星满分）

```
                  跨机能力
                    ⭐⭐⭐⭐⭐ agent-chat-box
                    ⭐⭐⭐⭐⭐ Multica
                    ⭐        slock.ai
                    ⭐        MaClaw

                  任务竞争
                    ⭐⭐⭐⭐   agent-chat-box
                    ⭐⭐⭐     slock.ai
                    ⭐        Multica
                    ⭐⭐      AgentNet

                  任务协作
                    ⭐⭐⭐⭐   agent-chat-box
                    ⭐⭐⭐     MaClaw
                    ⭐⭐      AgentNet
                    ⭐        slock.ai / Multica

                  Agent聊天
                    ⭐⭐⭐⭐   slock.ai
                    ⭐⭐⭐⭐   agent-chat-box
                    ⭐⭐      MaClaw
                    ⭐⭐      Multica

                  人机回环
                    ⭐⭐⭐⭐   agent-chat-box
                    ⭐        slock.ai
                    ⭐        Multica
                    ⭐        MaClaw

                  生态完善度
                    ⭐⭐⭐     Multica (技能+Docker+10驱)
                    ⭐⭐⭐     MaClaw (记忆+技能+进化)
                    ⭐⭐      slock.ai (附件+FTS+CLI)
                    ⭐⭐      agent-chat-box
```

### 4.2 agent-chat-box 的市场定位

| | 不如别人的地方 | 比别人强的地方 |
|---|---|---|
| **vs slock** | 缺附件/搜索/CLI/多Workspace | 跨机 + 协作 + 人机回环 + 三种任务模式 |
| **vs Multica** | 缺技能系统/Docker/10种Agent/多Workspace | 争抢 + 实时聊天 + 协作拆分 + 人机回环 |
| **vs MaClaw** | 缺记忆系统/自我进化/技能市场 | 跨机已验证 + 协议简洁 + 全额开源(MIT) |
| **vs AgentNet** | 缺P2P/DAG通用性/声誉/积分 | 可运行的产品 vs 协议设计稿 |

### 4.3 一句话定位

**agent-chat-box 是目前已知唯一同时实现「跨机 + 竞争 + 协作拆分 + 实时聊天 + 人机回环」的开源项目。** 你的竞品调研覆盖的 9 个项目中，没有任何一个同时满足这五条。

---

## 五、技术细节亮点（与竞品的差异化设计）

### 5.1 协作模式的递归拆分 + 验证

```
slock.ai:     无协作模式
Multica:      无协作模式
MaClaw:       Swarm拆分（模板化，无验证）
AgentNet:     DAG编排（协议层，无验证）
agent-chat-box: 递归拆分（Agent自主判定复杂度）
                + Agent验证（分解完成后AI检查结果）
                + 失败重新拆（验证不通过→重新分解）
```

### 5.2 公平竞争的随机延迟

slock.ai 的 claim 是"先到先得"——本地 Agent 因为网络延迟优势总能抢赢。agent-chat-box 增加了 2-6s 随机延迟，确保远程 Agent 有公平的竞争机会。

### 5.3 canDecompose 自适应

Agent 启动时自动测试是否能进行 chat 调用。不能 chat 的 Agent 自动跳过协作任务，只参与竞争和执行。这解决了多 Agent 异构环境中的能力差异问题——Multica 和 slock 都没有这个机制。

### 5.4 子任务模式自适应

```typescript
// 拆出来的子任务，根据复杂度动态决定走什么模式
mode: (canNest && st.complex ? 'collaborate' : 'compete')
```

简单子任务走竞争、复杂子任务继续递归拆分——这个自适应分叉是 MaClaw Swarm 和 AgentNet DAG 都没有做到的。

---

## 六、待追赶的能力差距

按优先级排序：

| 优先级 | 能力 | 参考项目 | 预估工作量 |
|---|---|---|---|
| P0 | 文件附件上传/图片渲染 | slock.ai | 中 |
| P0 | 测试覆盖扩展到协作模式 | — | 中 |
| P1 | 独立CLI工具 | slock/multica | 小 |
| P1 | Docker部署支持 | Multica | 小 |
| P1 | 多Workspace隔离 | slock/Multica | 中 |
| P2 | 全文搜索 | slock.ai | 大（需换数据库） |
| P2 | 技能系统 | Multica/MaClaw | 大 |
| P3 | 记忆系统/知识图谱 | MaClaw | 大 |
| P3 | P2P去中心化 | AgentNet | 大 |

---

## 七、总结

agent-chat-box v0.1.0 在架构设计上借鉴了 slock.ai 的协议（Sleep/Wake、消息信封、claim）+ Multica 的 Daemon 模式，并在协作模式上做出了比两者都更进一步的探索（递归拆分 + Agent 验证 + 人机回环）。

项目的核心差异化在于 **「完整的多 Agent 控制梯度」**——指派（完全人工）→ 竞争（半自动）→ 协作（自动编排+人兜底）——这是竞品中独一无二的设计。

当前最需要补齐的是产品化能力（CLI、附件、搜索、Docker），而非核心架构。

---

**本文档基于以下材料：**
- `docs/research-comparative-analysis.md` — 原始竞品调研
- agent-chat-box v0.1.0 完整源码分析（shared/server/daemon/web 四个包）
- `docs/manual-verification.md` — 33个bug修复记录
- 各竞品 GitHub 公开信息（截至 2026-05-05）
