# IDSD 完整工具链方案：替代 Garura 的实战 Harness 组装指南

> 方老师，这份文档是基于你知识库中的 IDSD 方法论、你的笔记《用IDSD开发"域"层的实操指南》，以及 2026 年最新 Harness Engineering 实践，为你量身定制的完整工具链方案。
>
> **核心结论**：Garura 尚未开源，但现有工具完全可以拼出一套成熟可用的 IDSD Harness。这套方案的核心思路是——**Claude Code 扮演"构建代理"，CLAUDE.md/AGENTS.md 扮演"Context 组装器"，自定义评估脚本扮演"Holdout Set 验证器"，Git + CI 扮演"持久化与回滚机制"**。

---

## 一、IDSD Harness 的核心职责 vs 现有工具映射

| IDSD Harness 职责 | Garura 的实现 | 我们的替代方案 | 具体工具 |
|---|---|---|---|
| **组装 Context** | 自动从代码→产品记忆→知识库提取 | 渐进式上下文加载 + 项目画像 | `CLAUDE.md` + `AGENTS.md` + 子目录 `.claude/` |
| **运行构建循环** | 代理在边界内自主构建，循环直到满足 Expectations | Claude Code Agent 模式 + 技能/子代理 | Claude Code + `/skills` + `subagents` |
| **场景评估（Holdout Set）** | 代理看不到的评估集，自动验证 | 外部维护的场景文件 + 自动化验证脚本 | 独立目录 `./holdout/` + `pytest`/`jest` + 自定义脚本 |
| **置信度标记** | 当模型自行推理时标记置信度 | 在 Prompt 中要求模型标注不确定性 | Claude Code 的 `thinking` 功能 + 自定义标签 |
| **三种速度管道** | `/build-feature` / `/start-planned-feature` / Full SDLC | 自定义 Skill/Prompt 模板 | `skill: fast-build` / `skill: planned-build` / `skill: strategic-build` |
| **Checkpoint 检查** | 在关键节点验证 Expectations | Pre-commit 钩子 + 自动化测试 + 人工抽检 | `husky` + `GitHub Actions` + 手动 Review |
| **知识库/记忆管理** | 自动关联产品记忆和标准 | 结构化文档 + 语义检索 | `ima.copilot` 知识库 + `mem0` / `Chroma` |

---

## 二、推荐工具链：分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    IDSD 工具链全景图                          │
├─────────────────────────────────────────────────────────────┤
│  L1 意图层 (Intent & Expectations)                          │
│    ├── 编写工具：任意 Markdown 编辑器 / ima.copilot 笔记    │
│    ├── 模板工具：自定义 `craft-ice` Skill（见附录）           │
│    └── 存储：项目根目录 `INTENTS/` + 知识库                 │
├─────────────────────────────────────────────────────────────┤
│  L2 上下文层 (Context Assembly)                              │
│    ├── 核心配置：`CLAUDE.md` + `AGENTS.md`（项目根目录）    │
│    ├── 分层配置：子目录 `.claude/CLAUDE.md`（按需加载）     │
│    ├── 产品记忆：`PROJECT_PROFILE.md`（项目画像）           │
│    ├── 架构规则：`ARCHITECTURE.md` + `.cursorrules`         │
│    └── 外部知识：ima.copilot 知识库（通过 MCP 接入）         │
├─────────────────────────────────────────────────────────────┤
│  L3 构建层 (Build Loop)                                      │
│    ├── 主代理：Claude Code（Agent 模式）                      │
│    ├── 规划代理：Claude Subagent（Initializer）               │
│    ├── 执行代理：Claude Subagent（Coding）                    │
│    ├── 代码生成：Claude Code / Codex CLI / Aider            │
│    └── 工具暴露：MCP 服务器（代码符号搜索、API 调用）        │
├─────────────────────────────────────────────────────────────┤
│  L4 验证层 (Verification & Holdout Set)                     │
│    ├── 自动化测试：pytest / jest / 项目测试框架               │
│    ├── Holdout Set：`./holdout/` 目录（代码库外）             │
│    ├── 评估脚本：`evaluate.py`（运行场景验证）                │
│    ├── 类型检查：mypy / tsc / ruff                            │
│    ├── Linter：eslint / ruff / 自定义架构 Linter              │
│    └── 架构约束：自定义 Linter 规则（强制分层）                │
├─────────────────────────────────────────────────────────────┤
│  L5 持久化层 (Persistence & State)                           │
│    ├── 版本控制：Git + 频繁提交                              │
│    ├── 进度追踪：`claude-progress.txt` / `feature_list.json`  │
│    ├── 会话移交：`handoff.md`（跨会话状态传递）              │
│    ├── CI/CD：GitHub Actions / GitLab CI（Agent 感知的流水线）│
│    └── 回滚机制：自动化回滚 + 分支保护                        │
├─────────────────────────────────────────────────────────────┤
│  L6 控制层 (Control & Safety)                                │
│    ├── 范围约束：单功能迭代（一次只做一个任务）               │
│    ├── 超时控制：Claude Code 最大步数限制                     │
│    ├── 安全护栏：文件系统沙箱（限制写入目录）                 │
│    ├── 钩子机制：Pre-commit / Post-session hooks              │
│    └── 熵管理：定期 "垃圾回收" Agent（清理技术债务）          │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、核心工具详解

### 3.1 主代理：Claude Code（强烈推荐）

**为什么选它？**
- 2026 年最成熟的 Agent 模式，原生支持 Skills、Subagents、Hooks
- Anthropic 官方发布了针对大型代码库的 Harness 构建指南
- 支持 `CLAUDE.md` 分层加载和 `MCP` 服务器扩展
- 你的 BMAD 经验可以直接迁移（你已经熟悉 Claude Code）

**安装**：`pip install claude-code` 或 `npm install -g @anthropic/claude-code`

### 3.2 Context 组装：CLAUDE.md 分层体系

这是替代 Garura "自动组装 Context" 的核心机制。

**文件结构**：
```
project-root/
├── .claudeignore           # ⭐ 屏蔽 holdout/scenarios/，AI 构建时不可见
├── CLAUDE.md              # 全局上下文（始终加载，60行以内）
├── AGENTS.md              # Agent 行为规则（约束和禁止事项）
├── PROJECT_PROFILE.md     # 项目画像（产品定位、阶段、规则）
├── .claude/
│   ├── hooks/
│   │   ├── start-hook.sh  # 会话启动时自动运行
│   │   └── stop-hook.sh   # 会话结束时自动运行
│   └── skills/
│       ├── fast-build.md      # /build-feature 技能
│       ├── planned-build.md   # /start-planned-feature 技能
│       ├── strategic-build.md # Full SDLC 技能
│       └── evaluate-scenarios.md # ⭐ 评估模式技能（评估时手动加载）
├── holdout/                  # ⭐ Holdout Set 评估体系
│   ├── evaluate.py           # 评估脚本（AI 可见）
│   ├── runner-config.json    # 评估配置（AI 可见）
│   ├── scenarios/            # ⭐ 场景文件（被 .claudeignore 屏蔽）
│   └── results/              # 评估结果（AI 可见）
├── src/
│   ├── app/
│   │   └── .claude.md     # 进入 app 目录时自动加载
│   └── lib/
│       └── .claude.md     # 进入 lib 目录时自动加载
└── docs/
    └── ARCHITECTURE.md    # 架构决策记录（Context 的一部分）
```

### 3.3 Holdout Set 评估：独立场景验证体系

这是 IDSD 最独特的机制，也是现有工具链中最需要手动搭建的部分。

**目录结构**：
```
project-root/
├── .claudeignore              # ⭐ 把 holdout/scenarios/ 加入屏蔽名单
├── holdout/                   # Holdout Set 评估体系
│   ├── scenarios/             # ⭐ 被 .claudeignore 屏蔽，AI 构建时物理不可见
│   │   ├── success/           # 成功场景
│   │   │   ├── domain-registration.md
│   │   │   ├── capability-discovery.md
│   │   │   └── reputation-update.md
│   │   ├── failure/           # 失败场景
│   │   │   ├── malicious-reputation-gaming.md
│   │   │   └── domain-node-crash.md
│   │   └── boundary/          # 边界场景
│   │       ├── multi-domain-membership.md
│   │       └── capability-mismatch.md
│   ├── evaluate.py            # 评估脚本（AI 可见，评估时可直接调用）
│   ├── runner-config.json     # 评估参数配置（AI 可见）
│   └── results/               # 评估结果（AI 可见，可分析）
│       └── 2026-06-16-domain-v1.json
```

**关键机制**：使用 `.claudeignore` 屏蔽场景文件，而不是堆人话。

```gitignore
# .claudeignore 内容
holdout/scenarios/
```

`holdout/scenarios/` 被 `.claudeignore` 列入后，Claude Code **在构建会话中物理上无法读取这些文件**——比在 CLAUDE.md 里写"别看"可靠一万倍。而 `evaluate.py` 和 `results/` 不受影响，评估时可以直接调用。

### 3.4 进度与状态：持久化机制

这是解决 AI "失忆症" 的关键。

| 文件 | 用途 | 更新时机 |
|---|---|---|
| `claude-progress.txt` | 记录当前任务进度、已完成步骤 | 每完成一个子任务 |
| `feature_list.json` | 结构化功能列表，Agent 间交接格式 | 规划阶段生成 |
| `handoff.md` | 会话结束时的状态摘要，下一个会话读取 | 会话结束时 |
| `checkpoint.md` | 已验证通过的 Expectations 列表 | 每次评估通过后 |

### 3.5 可选辅助工具

| 工具 | 用途 | 场景 |
|---|---|---|
| **Aider** | 多文件编辑、Git 集成更紧密 | 需要大量跨文件重构时 |
| **Codex CLI** | OpenAI 的 Agent 模式 | 如果你更信任 GPT-4o/Claude 混合 |
| **Cursor** | IDE 内集成，适合可视化调试 | 需要 GUI 辅助时 |
| **mem0 / Chroma** | 长期记忆/语义检索 | 超大型项目，需要跨会话记忆 |
| **Inngest** | 持久化事件驱动基础设施 | 多 Agent 协作、长时间运行任务 |
| **walkinglabs/learn-harness-engineering** | 开源 Harness 学习框架 | 想深入理解 Harness 原理时 |

---

## 四、三种速度管道的 Skill 配置

### 4.1 Fast 管道：`/build-feature`（分钟级）

**适用场景**：小而明确的任务，如修复 bug、添加简单 API

**文件**：`.claude/skills/fast-build.md`

```markdown
# Skill: fast-build

## 触发条件
用户输入 `/build-feature` 或描述为"小而明确的任务"

## 输入格式
- Intent: 1-2 句话描述要做什么
- Constraints: 最多 3 条约束（可选）
- Failure Conditions: 最多 2 条底线（可选）

## 执行规则
1. 读取 `CLAUDE.md` 和 `AGENTS.md` 获取 Context
2. 读取 `claude-progress.txt` 了解当前状态
3. 直接构建，不做设计阶段
4. 每次修改后运行相关测试
5. 完成后更新 `claude-progress.txt`

## 禁止事项
- 不要生成设计文档
- 不要询问"你希望怎么做"
- 不要在未运行测试前宣布完成
```

### 4.2 Planned 管道：`/start-planned-feature`（小时级）

**适用场景**：需要设计但不需要完整发现，如你的"域"层开发

**文件**：`.claude/skills/planned-build.md`

```markdown
# Skill: planned-build

## 触发条件
用户输入 `/start-planned-feature` 或描述为"需要设计的新功能"

## 输入格式（完整的 ICE）
- Intent: Goal + Constraints + Failure Conditions
- Expectations: 成功场景、失败场景、边界场景
- Context: 自动读取 `PROJECT_PROFILE.md` + `ARCHITECTURE.md`

## 执行规则
1. 读取完整 Context（代码库 + 产品记忆 + 架构规则）
2. 自主规划实现路径（不询问用户）
3. 按功能切片逐步构建
4. 每完成一个切片运行测试
5. 构建完成后，运行 `holdout/evaluate.py` 进行场景评估
6. 如果评估失败，分析原因并重新构建（最多 3 次循环）
7. 完成后更新 `checkpoint.md` 和 `claude-progress.txt`

## 构建循环
- 切片 1：数据模型 + 最小 API
- 切片 2：核心逻辑
- 切片 3：边界处理
- 切片 4：集成验证

## 禁止事项
- 不要问用户"你觉得这个设计怎么样"
- 不要在未运行 Holdout Set 前宣布完成
- 不要尝试读取 `.claudeignore` 或修改它
- 不要读取 `holdout/scenarios/` 目录下的任何文件（被 .claudeignore 屏蔽）
- 不要询问"评估标准是什么"
```

### 4.3 Strategic 管道：Full SDLC（天级）

**适用场景**：全新产品能力、架构级重构

**文件**：`.claude/skills/strategic-build.md`

```markdown
# Skill: strategic-build

## 触发条件
用户明确说明"这是一个战略级功能"或"/start-strategic"

## 执行规则
1. 完整读取所有 Context 文件
2. 生成 `feature_list.json`（结构化功能列表）
3. 使用 Subagent 进行代码库调研（Initializer Agent）
4. 按功能列表逐项执行（Coding Agent）
5. 每个功能完成后：测试 + Holdout Set 评估
6. 所有功能完成后：全量回归测试 + 架构约束检查
7. 生成 `handoff.md` 记录完整状态

## 人机会合点
- 功能列表生成后（用户确认是否遗漏）
- 每个主要切片完成后（用户抽检）
- 最终交付前（用户验收）
```

---

## 四（附）：评估模式 — 让 Claude Code 帮忙跑 Holdout Set

这是针对您"评估时也想用 Claude Code"的需求单独设计的。核心思路是 **"人格切换"**：

> **构建会话**：AI 是"考生" → 被 `.claudeignore` 屏蔽了场景文件
> **评估会话**：AI 是"考官" → 可以正常读取场景文件，帮忙跑 `evaluate.py` 并分析结果

### 操作流程

```bash
# ===== 构建模式（考生人格）=====
cd ~/projects/myapp
claude-code
# 此时 AI 看不到 holdout/scenarios/ 
# 运行 /start-planned-feature domain-data-model
# → 构建代理在边界内自主构建
# → 构建结束后，记录版本号如 domain-v2

# ===== 评估模式（考官人格）=====
# 新开一个终端，新开一个 Claude Code 会话
cd ~/projects/myapp
claude-code
# 此时你可以让 AI 帮忙跑评估
# 你说："帮我跑 domain-v2 的 Holdout Set 评估"
# → AI 读取 evaluate.py → 执行评估 → 读取结果 → 分析失败原因
```

### 评估 Skill 模板

**文件**：`.claude/skills/evaluate-scenarios.md`

```markdown
# Skill: evaluate-scenarios

## 触发条件
用户说"跑评估"、"验证"、"run holdout"或提供版本标签

## 输入格式
- version_tag: 构建完成的版本标识（如 "domain-v2"）

## 执行规则
1. 读取 `holdout/runner-config.json` 获取评估配置
2. 运行 `python holdout/evaluate.py <version_tag>`
3. 读取 `holdout/results/<version_tag>.json` 分析结果
4. 汇总报告：
   - ✅ 通过率
   - ❌ 失败场景详情（哪个场景、失败原因）
   - 📊 与上一次评估的对比趋势
5. 对失败场景提出修复建议

## 注意事项
- 不要修改 `holdout/scenarios/` 下的场景文件
- 不要修改 `evaluate.py` 的逻辑
- 如果评估失败，先分析原因，再建议修复方案
```

### 关于 `.claudeignore` 的补充说明

`.claudeignore` 只在 **Claude Code 自动扫描/读取文件** 时生效，阻止 AI "主动翻阅"被屏蔽的目录。

评估模式下，是你**手动输入命令**让 AI 执行 `python holdout/evaluate.py`——这是你指令驱动的操作，AI 按照你的要求运行脚本，脚本本身可以正常访问 `scenarios/`。

所以三种场景各得其所：
| 场景 | `.claudeignore` | AI 能否看到 scenarios/ | 能做什么 |
|------|-----------------|----------------------|----------|
| 构建时（考生人格） | 生效 | ❌ 不可见 | 在边界内自主构建 |
| 评估时（考官人格） | 生效但不影响 | ✅ 通过 evaluate.py 间接访问 | 跑评估 + 分析结果 |
| 你手动打开 scenarios/ | 不涉及 | ✅ 你肉眼可见 | 编辑场景文件 |

---

## 五、从 BMAD 到 IDSD 的平滑迁移路径

你已经在用 BMAD，不需要推倒重来。以下是渐进式迁移方案：

### 阶段 1：本周（搭建 Harness 基础设施）

1. **创建核心 Context 文件**：
   - 写 `PROJECT_PROFILE.md`（项目画像，半天时间）
   - 写 `CLAUDE.md`（全局上下文，60行以内）
   - 写 `AGENTS.md`（Agent 行为规则）
   - 把 BMAD 的架构设计文档整理进 `ARCHITECTURE.md`

2. **创建 Holdout Set 目录结构**：
   - 创建 `holdout/` 目录
   - 写 3-5 个成功场景、2-3 个失败场景、2-3 个边界场景
   - 写 `evaluate.py` 脚本（初始版本可以手动运行）
   - 配置 `.claudeignore` 屏蔽 `holdout/scenarios/`

3. **创建三种 Skill 模板**：
   - 在 `.claude/skills/` 下创建三个 skill 文件
   - 可选：创建 `evaluate-scenarios.md` 评估 skill

### 阶段 2：下周（第一个 IDSD 实验）

1. 选择"域"层的第一切片（数据模型 + 注册 API）
2. 写完整的 ICE（Intent + Expectations）
3. 用 `/start-planned-feature` 运行，不干预中间过程
4. 运行 Holdout Set 评估，记录结果
5. 对比：IDSD 结果 vs BMAD 结果，差距在哪？

### 阶段 3：第 3-4 周（扩大或调整）

- 如果结果可接受 → 用 IDSD 继续第二、第三切片
- 如果结果有偏差 → 分析原因：
  - Intent 不够精确？→ 修改 ICE 写法
  - Context 不完整？→ 补充 `CLAUDE.md` 或 `ARCHITECTURE.md`
  - 代理在某些节点确实需要指导？→ 在 Skill 中增加"人机会合点"

### 阶段 4：持续优化 Harness

遵循 Mitchell Hashimoto 的原则：
> "每当 Agent 犯错时，就花时间设计一个工程化方案，使该类错误永远不再发生。"

- Agent 在某类错误上反复犯错？→ 在 `AGENTS.md` 中加一条规则
- Agent 找不到某些 Context？→ 在 `CLAUDE.md` 中补充目录映射
- Agent 产出与期望偏差？→ 在 `holdout/` 中增加对应场景
- 评估脚本太复杂？→ 简化 `evaluate.py`，优先验证核心行为

---

## 六、你之前 BMAD 经验的复用

| 你在 BMAD 中积累的 | 在 IDSD 中的价值 |
|---|---|
| 团队层、群层的架构设计文档 | → `ARCHITECTURE.md` + `PROJECT_PROFILE.md` |
| 对 Agent 通信协议、权限模型的理解 | → 写入 `Intent` 的 `Constraints` |
| 每步审核中发现过的典型 AI 错误 | → `AGENTS.md` 中的规则 + `Failure Conditions` |
| TEA 的自动化测试经验 | → `holdout/evaluate.py` 的场景评估 |
| BMAD-METHOD 的文档规范 | → `CLAUDE.md` 的格式参考 |
| Claude Code 的使用经验 | → 直接复用，只需增加 Skill 配置 |

---

## 七、关键注意事项

1. **不要过度工程**：先从最简单的版本开始，只在 Agent 实际失败后才添加配置。一个 20 行的 `CLAUDE.md` 比一个 200 行的更有效。

2. **Context 文件会过时**：通过 `stop-hook.sh` 自动分析代码变更，提议更新 `CLAUDE.md`。否则规则会变成"陈旧规则墓地"。

3. **Holdout Set 是核心防线**：宁可场景少而精，不要多而滥。5 个精确的场景 > 50 个模糊的场景。

4. **一次只做一个功能**：不要让 Agent 在一个会话里做多个任务，这是上下文腐烂的元凶。

5. **成本预期**：完整 Harness（多 Agent + 持续验证）可能让运行成本提升 5-10 倍，但相比人工审核 40% 的占比，仍然是赚的。

6. **保留人工最终审查**：Harness 目前对"功能是否符合用户意图"的行为正确性保证有限，最终验收仍然需要人。

7. **`不用分仓库，用 .claudeignore`**：`holdout/scenarios/` 放在项目内即可，通过 `.claudeignore` 屏蔽构建时的 AI 读取。评估时新开一个会话手动跑，AI 按你的指令执行 `evaluate.py`，不受限制。

8. **构建和评估用不同会话**：不要在同一会话中既构建又评估。构建完了关掉会话，开新会话做评估——"考生"和"考官"不能是同一个人。

---

## 八、一句话总结

> **Claude Code 是引擎，CLAUDE.md 是地图，.claudeignore 是盾牌，Holdout Set 是考官，Git 是记忆。**
>
> 构建时 AI 是"考生"，评估时 AI 是"考官"——同一套代码，两套人格，互不干扰。
>
> 你不需要等 Garura 开源。今天就能用这套工具链跑 IDSD。

---

## 附录 A：完整文件模板

### A.1 `CLAUDE.md` 模板

```markdown
# Project: [你的项目名称]

## Stack
- 语言/框架：[如 Go 1.24 + Gin]
- 数据库：[如 PostgreSQL 16]
- 消息队列：[如 NATS]
- 部署：[如 Docker + K8s]

## Architecture
- `src/app/` — HTTP 路由和 handler
- `src/domain/` — 领域模型和核心业务逻辑
- `src/infra/` — 基础设施（数据库、缓存、消息）
- `src/shared/` — 共享工具类和常量
- `tests/` — 测试文件（与源码平行结构）

## Rules
- 领域层不能依赖基础设施层（依赖方向：infra → domain）
- 所有 API 返回统一封装 `Result{T}`
- 错误处理统一使用 `apperrors` 包，禁止裸抛 `errors.New`
- 数据库操作必须走 `Repository` 接口，禁止直接写 SQL

## Common Tasks
- 运行测试：`go test ./...`
- 运行单个测试：`go test ./src/domain/...`
- 构建：`go build -o bin/server ./src/app`
- 检查类型：`go vet ./...`
```

### A.2 `AGENTS.md` 模板

```markdown
# Agent 行为规则

## 绝对禁止
- 不要修改 `./holdout/` 目录下的任何文件
- 不要在未运行测试前宣布任务完成
- 不要直接在生产配置文件中硬编码敏感信息
- 不要用 `fmt.Println` 做日志，统一用 `logger` 包

## 常见错误预防
- 新增 API 时：先检查 `src/app/routes.go` 是否已注册路由
- 修改领域模型时：同步检查所有依赖该模型的 Repository 实现
- 使用第三方库时：先在 `go.mod` 中确认是否已引入，不要重复引入

## 工作习惯
- 每次修改后保存文件，然后运行相关测试
- 遇到不确定的问题时，先读 `ARCHITECTURE.md` 再决定
- 跨文件修改超过 5 个文件时，先写 `handoff.md` 记录进度
```

### A.3 `PROJECT_PROFILE.md` 模板（项目画像）

```markdown
# Project Profile: 多 Agent 协作平台

## 产品定位
为个人和团队提供分布式 Agent 的协作基础设施，支持团队→群→域的多层组织架构。

## 当前阶段
- 团队层：已完成（Agent 身份、Claim 机制）
- 群层：已完成（契约信任、任务广播、成果共享）
- 域层：进行中（声誉信任、能力注册中心、跨群协作）

## 必须遵守的规则
- Agent 身份体系：基于 DID 的去中心化身份
- 通信协议：gRPC + Protocol Buffers
- 消息格式：统一使用 `MessageEnvelope` 封装
- 权限模型：RBAC + 能力声明
- 数据存储：PostgreSQL（关系数据）+ Redis（缓存/消息）

## 复用模块
- `shared/auth` — 身份认证
- `shared/crypto` — 加密工具
- `shared/messaging` — 消息封装和序列化
```

### A.4 `holdout/evaluate.py` 模板（Python 示例）

```python
#!/usr/bin/env python3
"""
IDSD Holdout Set 评估脚本
运行所有场景验证，生成结果报告
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Literal

Status = Literal["PASS", "FAIL", "SKIP"]

class ScenarioEvaluator:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.holdout_dir = project_root / "holdout"
        self.results_dir = self.holdout_dir / "results"
        self.results_dir.mkdir(exist_ok=True)
    
    def load_scenarios(self, category: str) -> List[Dict]:
        """加载某一类场景（success/failure/boundary）"""
        scenarios = []
        category_dir = self.holdout_dir / "scenarios" / category
        if not category_dir.exists():
            return scenarios
        
        for file in category_dir.glob("*.md"):
            content = file.read_text()
            scenarios.append({
                "name": file.stem,
                "category": category,
                "description": content
            })
        return scenarios
    
    def evaluate_scenario(self, scenario: Dict) -> Status:
        """
        评估单个场景。这里需要接入实际的项目测试逻辑。
        例如：启动服务、调用 API、检查结果
        """
        # TODO: 根据场景描述执行对应的验证逻辑
        # 示例：如果是 "domain-registration"，调用注册 API 检查响应
        print(f"  评估场景: {scenario['name']} ({scenario['category']})")
        
        # 简化示例：假设所有场景都通过
        # 实际实现中，这里应该是具体的测试代码
        return "PASS"
    
    def run_all(self) -> Dict:
        """运行所有场景评估"""
        results = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "scenarios": []
        }
        
        for category in ["success", "failure", "boundary"]:
            scenarios = self.load_scenarios(category)
            for scenario in scenarios:
                status = self.evaluate_scenario(scenario)
                results["total"] += 1
                results["passed" if status == "PASS" else "failed" if status == "FAIL" else "skipped"] += 1
                results["scenarios"].append({
                    "name": scenario["name"],
                    "category": category,
                    "status": status
                })
        
        return results
    
    def save_results(self, results: Dict, version: str):
        """保存评估结果到文件"""
        output_file = self.results_dir / f"{version}.json"
        with open(output_file, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n结果已保存: {output_file}")
    
    def print_summary(self, results: Dict):
        """打印评估摘要"""
        print("\n" + "="*50)
        print("IDSD Holdout Set 评估结果")
        print("="*50)
        print(f"总场景数: {results['total']}")
        print(f"通过: {results['passed']} ✅")
        print(f"失败: {results['failed']} ❌")
        print(f"跳过: {results['skipped']} ⏭️")
        print(f"通过率: {results['passed']/results['total']*100:.1f}%")
        print("="*50)


def main():
    if len(sys.argv) < 2:
        print("用法: python evaluate.py <version_tag>")
        print("示例: python evaluate.py domain-v1")
        sys.exit(1)
    
    version = sys.argv[1]
    project_root = Path(__file__).parent.parent  # holdout/ 的上级目录
    
    evaluator = ScenarioEvaluator(project_root)
    results = evaluator.run_all()
    evaluator.save_results(results, version)
    evaluator.print_summary(results)
    
    # 如果有失败场景，退出码非 0（CI 使用）
    if results["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
```

---

## 附录 B：推荐阅读顺序

1. 先读你的笔记《用IDSD开发"域"层的实操指南》（已读，没问题）
2. 配置本文档的 `阶段 1`（半天时间）
3. 选择"域"层第一切片，写 ICE
4. 用 `/start-planned-feature` 跑一遍，记录体验
5. 根据体验调整 `CLAUDE.md` / `AGENTS.md` / Skill
6. 逐步优化，直到稳定

---

> 方老师，如果这套方案您觉得方向对，我可以进一步帮你：
> 1. 根据你的具体项目技术栈，定制化 `CLAUDE.md` 和 `AGENTS.md`
> 2. 帮你写第一个功能切片的完整 ICE（Intent + Expectations）
> 3. 设计 `holdout/` 的具体场景和 `evaluate.py` 的验证逻辑
> 4. 把这些配置打包成一个可复用的 Skill，直接加载到 Claude Code 中
>
> 需要哪一项，随时告诉我！
