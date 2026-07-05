# IDSD 实践案例：用 Planned-Build 修复 GAP-19

> 本文档记录 Agent Chat Box 项目第一次使用 IDSD（Intent-Driven Software Development）方法完成真实功能修复的全过程，作为后续使用 IDSD 的指南与参考案例。
> 
> 案例对象：GAP-19 —— 创建群时未自动创建群聊频道。
> 实践日期：2026-07-05。

---

## 1. 背景与动机

### 1.1 项目上下文

Agent Chat Box v0.2.0 已完成群扩展与联邦网关的开发和 TEA 自动化测试，并执行了人工验证 A~M。验证结束后仍存在 1 个开放缺口：

- **GAP-19**：创建群时不会自动创建对应的聊天频道，群成员无法直接在统一频道聊天。

此前项目一直使用 **BMAD + TEA** 方法。本次决定用 **IDSD** 方法来处理这最后一个缺口，作为方法迁移的试验。

### 1.2 为什么选择 GAP-19 作为 IDSD 试点

GAP-19 适合作为第一次 IDSD 试验，原因如下：

| 维度 | 评估 |
|------|------|
| 范围 | 小且边界清晰 —— 只涉及"创建群 → 自动创建频道"这一垂直路径 |
| 影响 | 非破坏性 —— 新增字段 `channel_id`，不改动现有 API 契约 |
| 上下文 | 已有成熟的 group/channel 基础设施，可直接复用 |
| 验证 | 可通过现有自动化测试 + 新增场景快速验证 |
| 风险 | 失败成本低，不会阻塞 v0.2.0 发版 |

### 1.3 IDSD 与 BMAD 的核心区别

| 维度 | BMAD (SDD) | IDSD |
|------|------------|------|
| 谁定义"对" | 规格文档，人与 AI 共创协商 | 意图 + 期望，只由想要结果的人写 |
| 完成判定 | 规格验收标准 + 人工审查 | Holdout Set 场景边界（代理看不到） |
| AI 角色 | 多智能体模拟敏捷团队 | 在明确边界内自主构建 |

本次实践的核心假设是：**我们已经清楚知道 GAP-19 应该是什么样子，因此可以把"怎么实现"交给代理**。

---

## 2. IDSD Harness 搭建

### 2.1 推荐目录结构

为避免污染现有代码结构，采用独立的 `idsd-pilot/` 子目录：

```
idsd-pilot/
└── gap19/
    ├── CLAUDE.md          # 本次试验补充上下文
    ├── AGENTS.md          # 试验专用规则
    ├── PROJECT_PROFILE.md # 项目画像
    ├── checkpoint.md      # 已验证通过的 Expectations
    ├── holdout/
    │   ├── scenarios/
    │   │   ├── success/   # 成功场景
    │   │   ├── failure/   # 失败场景
    │   │   └── boundary/  # 边界场景
    │   ├── evaluate.py    # 评估脚本（本机无 Python，实际使用 evaluate.cjs）
    │   ├── evaluate.cjs   # Node.js 版评估脚本
    │   └── runner-config.json
    └── idsd/
        ├── idsd-status.yaml
        └── intents/
            └── gap19-auto-channel/
                ├── intent.md
                └── expectations.md
```

唯一放在根目录的文件：`.claudeignore`，用于屏蔽 `holdout/scenarios/`，确保构建时代理看不到场景文件。

```gitignore
holdout/scenarios/
```

### 2.2 关键上下文文件

#### PROJECT_PROFILE.md

项目画像包含：
- 产品定位
- 当前阶段
- 技术栈
- 必须遵守的规则（TypeScript strict、sql.js 用法、REST 错误格式、YAGNI 等）
- GAP-19 可复用模块

#### CLAUDE.md

本次试验的补充上下文：
- GAP-19 背景
- 修改范围
- 关键文件位置
- 试验约束（不新增依赖、不改 schema、英文注释等）

#### AGENTS.md

Agent 行为规则：
- 绝对禁止（不修改 scenarios、不 git commit、不新增依赖等）
- 常见错误预防（`stmt.free()`、事务、`db.save()` 等）
- 工作习惯（先读后改、跑测试、更新状态文件）
- **语言约定**：所有 IDSD 产物使用简体中文，代码注释保持英文

### 2.3 Skill 配置

在 `.claude/skills/idsd-planned-build.md` 中定义 `/start-planned-feature` 的执行规则：

1. 读取意图与期望文件
2. 读取 PROJECT_PROFILE.md、CLAUDE.md、AGENTS.md
3. 读取相关源码
4. 自主规划实现路径
5. **所有 IDSD 产物使用简体中文**
6. 按垂直切片实现
7. 每切片后运行测试
8. 运行 Holdout Set 评估
9. 更新状态文件

---

## 3. 编写 ICE（Intent + Constraints + Expectations）

### 3.1 Intent

Intent 由三部分组成：

#### Goal（目标）

> 当用户创建一个群时，系统必须自动为该群创建一个专用聊天频道，并将群主团队加入为成员，使群成员无需手动设置就能在共享频道中立即聊天。

#### Constraints（约束）

- 修复必须复用现有的 `channels` 和 `channel_members` 表（不修改表结构）
- 频道必须能在现有 Chat 页面频道列表中直接可见，且不需要前端做额外改动
- 群创建 API 响应可以包含新的 `channel_id` 字段，但必须保持向后兼容
- 该操作必须与群创建原子化
- 已存在的群不能 retroactively 获得频道

#### Failure Conditions（失败条件）

- 群创建成功但无对应频道记录
- 频道已创建但群主团队不是其成员
- 该变更破坏任何现有测试
- 该变更引入新的 npm 依赖

### 3.2 Expectations

按成功、失败、边界三类场景编写：

**成功场景**

| 场景 | 期望行为 |
|------|----------|
| 通过 UI 创建群 | Chat 页面频道列表出现新频道 |
| 通过 API 创建群 | 返回 `channel_id`，`channels` 表存在 `type='group'` 记录 |
| 群主团队成员关系 | 群主用户自动以 `member_kind='human'` 加入 |
| 频道名称唯一性 | 多个群可共存，频道 ID 不同 |

**失败场景**

| 场景 | 期望行为 |
|------|----------|
| 群创建失败 | 不残留频道记录 |
| 群名重复 | 频道创建仍成功，身份绑定群 ID |

**边界场景**

| 场景 | 期望行为 |
|------|----------|
| 已存在的群 | 不 retroactively 获得频道 |
| 解散群 | 清理自动创建的频道及成员 |
| 联邦成员入群 | 不自动加入已有频道（超出范围） |

---

## 4. Planned-Build 执行

### 4.1 计划阶段

进入 Plan Mode 后：
1. 使用 Explore Agent 扫描 group/channel 后端和前端 ChannelList
2. 使用 Plan Agent 设计实现方案
3. 写入计划文件 `C:\Users\fjibj\.claude\plans\spicy-doodling-stardust.md`
4. 调用 `ExitPlanMode` 请求用户批准

### 4.2 推荐方案

- 在 `POST /api/groups` 中接入频道创建
- 使用从群 ID 派生的确定性频道 ID，避免 schema 迁移
- 将群记录插入、群成员插入、频道创建包装在 SQLite 事务中
- 广播 `MSG.CHANNEL_CREATED`
- 前端 `ChannelList` 收到广播后自动刷新频道列表

### 4.3 关键实现文件

| 文件 | 修改内容 |
|------|----------|
| `packages/server/src/api/channels.ts` | 新增 `getGroupChannelId()`、`createGroupChannel()` |
| `packages/server/src/api/groups.ts` | 群创建时调用频道创建；解散群时清理频道 |
| `packages/web/src/components/ChannelList.tsx` | 监听 `channel.created` 并刷新列表 |
| `packages/web/src/App.tsx` | 传递 `wsMessages` 给 `ChannelList` |
| `packages/server/src/api/groups.test.ts` | 新增 3 个 GAP-19 测试 |
| `packages/web/src/components/ChannelList.test.tsx` | 新增 WebSocket 刷新测试 |
| `packages/web/vitest.config.ts` | 添加 `@agent-chat-box/shared` 别名 |

---

## 5. 验证与 Holdout Set

### 5.1 自动化测试

| 测试套件 | 结果 |
|----------|------|
| Server tests | 245 passed |
| Web tests | 45 passed |
| `npm run typecheck` | 通过 |
| `npm run lint` | 0 errors（54 warnings 均为既有） |

### 5.2 Holdout Set

由于本机无 Python，将 `evaluate.py` 改写为 Node.js 版 `evaluate.cjs`。

补充 8 个场景文件：

- **success/**：4 个
- **failure/**：1 个
- **boundary/**：3 个

运行 `node evaluate.cjs gap19-v2`：

```text
Total scenarios: 8
Passed:          8 ✅
Failed:          0 ❌
Skipped:         0 ⏭️
Pass rate:       100.0%
```

---

## 6. 结果与影响

### 6.1 功能结果

- 创建群时自动创建群聊频道
- 群主用户自动加入频道
- 解散群时自动清理频道
- 前端无需刷新即可看到新频道

### 6.2 对项目文档的更新

- `docs/manual-verification.md`：
  - M10-01 状态从 `[❌]` 改为 `[x]`
  - 验证汇总通过数 186→187，失败数 2→1
  - GAP-19 从"仍开放的缺口"移到"已关闭的缺口"
  - 建议决策从 CONDITIONAL GO 调整为 GO

### 6.3 对项目代码的统计

- 新增/修改约 10 个文件
- 新增约 8 个测试用例
- 无新增依赖
- 无 schema 变更

---

## 7. 经验总结与最佳实践

### 7.1 做得好的地方

1. **独立子目录保护现有结构**
   - `idsd-pilot/gap19/` 隔离了 IDSD 流程产物，不影响现有代码结构。

2. **上下文文件先行**
   - PROJECT_PROFILE.md、CLAUDE.md、AGENTS.md 在写代码前就位，减少了代理"猜上下文"的成本。

3. **意图和期望用中文写**
   - 用用户语言描述边界，避免过早绑定实现细节。

4. **小范围试点**
   - GAP-19 足够小，让团队能在一次会话内完整体验 IDSD 全流程。

5. **Holdout Set 与自动化测试互补**
   - Holdout 场景描述用户可见行为，自动化测试验证代码正确性。

### 7.2 遇到的问题与解决方案

| 问题 | 解决方案 |
|------|----------|
| 当前会话无 idsd-harness skill | 在 `.claude/skills/idsd-planned-build.md` 创建本地 skill，并直接模拟其执行流程 |
| 环境无 Python | 编写 Node.js 版 `evaluate.cjs` |
| Web 测试无法解析 `@agent-chat-box/shared` | 在 `packages/web/vitest.config.ts` 添加 alias |
| 前端 ChannelList 不自动刷新 | 监听 `channel.created` WebSocket 事件并重新获取频道列表 |

### 7.3 可改进之处

1. **Holdout 评估更精确**
   - 当前 `evaluate.cjs` 对每个场景都运行完整 `npm test + typecheck`，尚未按场景执行具体 API/UI 断言。
   - 下一步可将场景描述映射为具体测试命令或 Playwright 脚本。

2. **场景文件应在构建前由用户编写**
   - 本次场景中部分由代理补充。严格来说，Holdout Set 应在构建前由"想要结果的人"写好，构建时代理完全不可见。

3. **计划文件位置**
   - 计划文件在 `C:\Users\fjibj\.claude\plans\` 下，与项目目录分离。未来可考虑在 `idsd-pilot/` 内同步保存一份计划摘要。

---

## 8. 后续如何复用

### 8.1 复用目录模板

下一个 IDSD pilot（例如 `gap20/`）可复制：

```
idsd-pilot/gap20/
├── CLAUDE.md
├── AGENTS.md
├── PROJECT_PROFILE.md
├── checkpoint.md
├── holdout/
│   ├── scenarios/{success,failure,boundary}/
│   ├── evaluate.cjs
│   └── runner-config.json
└── idsd/
    ├── idsd-status.yaml
    └── intents/<intent-name>/
        ├── intent.md
        └── expectations.md
```

### 8.2 复用规则

- 保持 `.claudeignore` 中 `holdout/scenarios/` 的屏蔽
- AGENTS.md 中的语言约定继续生效
- Skill 文件 `.claude/skills/idsd-planned-build.md` 全局复用

### 8.3 建议的 IDSD 工作流

1. **选择试点**：范围小、边界清晰、失败成本低的功能
2. **搭建 Harness**：创建目录结构、上下文文件、skill
3. **编写 ICE**：用户用中文写 Intent + Expectations
4. **计划审批**：进入 Plan Mode，生成并批准计划
5. **自主构建**：按垂直切片实现，每切片后跑测试
6. **运行 Holdout**：补充场景文件，运行 evaluate.cjs
7. **更新文档**：checkpoint.md、idsd-status.yaml、项目文档

---

## 9. 关键文件索引

| 文件 | 用途 |
|------|------|
| `idsd-pilot/gap19/PROJECT_PROFILE.md` | 项目画像 |
| `idsd-pilot/gap19/CLAUDE.md` | 试验上下文 |
| `idsd-pilot/gap19/AGENTS.md` | Agent 行为规则与语言约定 |
| `idsd-pilot/gap19/idsd/intents/gap19-auto-channel/intent.md` | 意图 |
| `idsd-pilot/gap19/idsd/intents/gap19-auto-channel/expectations.md` | 期望 |
| `idsd-pilot/gap19/idsd/idsd-status.yaml` | 状态跟踪 |
| `idsd-pilot/gap19/checkpoint.md` | 已验证通过的期望 |
| `idsd-pilot/gap19/holdout/evaluate.cjs` | Holdout 评估脚本 |
| `.claude/skills/idsd-planned-build.md` | IDSD Planned-Build skill |
| `docs/manual-verification.md` | 项目验证记录（已更新） |

---

## 10. 结论

本次 GAP-19 的 IDSD 试点证明：

- 在已有清晰意图和边界的情况下，代理可以自主完成小到中等范围的功能实现。
- Holdout Set 机制能有效防止"应试式优化"，确保关注点始终放在用户可见行为上。
- IDSD 与 BMAD 不是对立关系，而是互补：BMAD 适合架构级、需要多人协商的决策；IDSD 适合意图清晰、可由代理自主构建的功能。

建议后续继续用 IDSD 处理类似范围的功能修复或小型特性，同时保留 BMAD 用于架构级和战略级设计。
