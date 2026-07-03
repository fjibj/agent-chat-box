# AC Coverage Matrix — v0.2.0 Manual Verification Addendum

**项目:** Agent Chat Box  
**版本:** v0.2.0  
**创建日期:** 2026-06-21  
**来源:** [manual-verification.md §O](../manual-verification.md) + [process-retrospective-v0.2.0.md](../process-retrospective-v0.2.0.md)  
**目的:** 追踪 v0.2.0 中 G023~G026、F006~F007 等故事的 Acceptance Criteria 是否有充分测试覆盖。

---

## 1. 状态说明

| 状态 | 含义 |
|------|------|
| **Covered** | AC 已由自动化测试覆盖，断言能验证关键行为 |
| **Partial** | 有测试，但只覆盖组件或浅路径，不足以证明 AC 成立 |
| **Manual** | 已进入 `manual-verification.md`，当前需人工确认 |
| **Missing** | 无自动化测试，也无人工验证项 |
| **Blocked** | 依赖功能未实现，需 follow-up story |

---

## 2. Epic-006 群管理 UI 覆盖矩阵

### STORY-G023：群管理页面

| AC ID | Acceptance Criterion | Unit | Integration | E2E | Manual | 当前状态 | 发现 |
|-------|----------------------|------|-------------|-----|--------|----------|------|
| G023-AC01 | 群列表页 `/groups` 显示已加入群（名称、成员数、我的角色、契约模式） | | TC-G023-001（仅标题/空态） | | M2-01~M2-10 | Partial | 未验证我的角色、契约模式 |
| G023-AC02 | 群详情页显示契约配置、成员列表、邀请码 | | TC-G023-004（邀请码），TC-G023-005（契约保存） | | M2-11~M2-46 | Partial | 成员角色/信誉未充分测试 |
| G023-AC03 | 创建群表单：名称、描述 | | TC-G023-002 | | M2-02~M2-10 | Covered | |
| G023-AC04 | 加入群入口：输入邀请码 | | TC-G023-003 | | M2-16~M2-22 | Partial | UI teamId 写死，仅能默认团队 |
| G023-AC05 | shared_capabilities 多选输入 | | | | M2-41~M2-42 | Missing | GAP-09，UI 未实现 |
| G023-AC06 | resource_quota.max_tasks_per_hour 数字输入 | | TC-G023-005（弱断言） | | M2-35~M2-38 | Partial | 只测试保存 body，不测持久化回显 |
| G023-AC07 | resource_quota.max_retry_per_task 数字输入 | | | | | Missing | UI 未实现 |
| G023-AC08 | authorization auto/manual 控件 | | TC-G023-005 | | M2-32~M2-38 | Covered | |
| G023-AC09 | trust_threshold 0~1 滑块 | | | | M2-34, M2-39 | Manual | 缺自动化 |
| G023-AC10 | visibility.task_input 开关 | | | | | Missing | UI 未实现 |
| G023-AC11 | visibility.task_output 开关 | | | | M2-36~M2-38 | Manual | 缺自动化 |
| G023-AC12 | visibility.internal_log 开关 | | | | M2-36~M2-38 | Manual | 缺自动化 |
| G023-AC13 | 退群 UI | | | | M2-23~M2-26 | Blocked | GAP-05，UI 未实现 |
| G023-AC14 | 解散群 UI | | | | M2-27~M2-30 | Blocked | GAP-05，UI 未实现 |

### STORY-G024：跨团队任务看板

| AC ID | Acceptance Criterion | Unit | Integration | E2E | Manual | 当前状态 | 发现 |
|-------|----------------------|------|-------------|-----|--------|----------|------|
| G024-AC01 | 任务看板有「内部」和「群」标签页 | | TC-G024-001（只测三列） | | M9-01~M9-02 | Missing | GAP-02，UI 未实现标签页 |
| G024-AC02 | 群任务列表显示任务标题、发布者团队、claim 团队、授权状态、review 状态 | | | | M9-03~M9-05 | Missing | TaskCard 未渲染 source_team/review |
| G024-AC03 | 支持按群筛选任务 | | | | | Missing | UI 未实现 |
| G024-AC04 | 外部任务和内部任务视觉区分 | | | | M9-02 | Missing | GAP-02 |
| G024-AC05 | pending_authorization 黄色状态标签 | | | | M9-10~M9-12 | Missing | GAP-03/04 |
| G024-AC06 | authorized 蓝色状态标签 | | | | | Missing | 状态模型未映射 authorized |
| G024-AC07 | review_pending 紫色状态标签 | | | | | Missing | 状态模型未映射 review_pending |
| G024-AC08 | 点击任务查看详情（含 output、review 结果） | | TaskDetailModal 部分测试缺失 | | M9-03 | Partial | review 结果未显示 |

### STORY-G025：授权审批 UI

| AC ID | Acceptance Criterion | Unit | Integration | E2E | Manual | 当前状态 | 发现 |
|-------|----------------------|------|-------------|-----|--------|----------|------|
| G025-AC01 | `/authorizations` 显示待处理和已处理审批请求 | | TC-G025-001（仅待处理倒计时） | | M5-01~M5-07 | Partial | 已处理列表未实现 |
| G025-AC02 | 待处理列表显示任务标题、claim 团队名称、claim Agent 名称、信誉分、剩余时间 | | TC-G025-001（仅倒计时） | | M5-01~M5-07 | Partial | claim 团队名称截断，信誉分未显示 |
| G025-AC03 | 一键批准/拒绝按钮 | | | | M5-08~M5-20 | Manual | 缺自动化 UI 断言 |
| G025-AC04 | 超时倒计时红色警告 <1 分钟 | | TC-G025-001 | | M5-03~M5-05 | Covered | |
| G025-AC05 | 已处理列表显示结果和处理时间 | | | | | Missing | UI 未实现 |
| G025-AC06 | 空状态提示 | | | | M1-06 | Manual | 缺自动化 |

### STORY-G026：信誉分展示

| AC ID | Acceptance Criterion | Unit | Integration | E2E | Manual | 当前状态 | 发现 |
|-------|----------------------|------|-------------|-----|--------|----------|------|
| G026-AC01 | 群成员列表显示各团队信誉分 | TC-G026-001（仅组件颜色） | | | M6-08~M6-10 | Missing | GAP-06，页面未使用组件 |
| G026-AC02 | 审批界面显示 claim 团队信誉分 | TC-G026-001（仅组件颜色） | | | M6-08~M6-10 | Missing | GAP-06 |
| G026-AC03 | 颜色规则：>=5 绿、1-4 黄、<=0 红 | TC-G026-001 | | | | Covered | 注意组件实现当前 >=4 绿，与故事 >=5 有差异需确认 |
| G026-AC04 | 信誉分详情弹窗（事件列表） | | | | | Missing | UI 未实现 |

---

## 3. Federation / Label Routing 覆盖矩阵

### STORY-F006：标签匹配任务路由

| AC ID | Acceptance Criterion | Unit | Integration | E2E | Manual | 当前状态 | 发现 |
|-------|----------------------|------|-------------|-----|--------|----------|------|
| F006-AC01 | 群任务发布 API 支持 `required_labels` 字段 | | | | M8-05~M8-07 | Partial | 实际复用 required_capabilities / required_labels 命名需统一 |
| F006-AC02 | Hub/源团队 Server 存储 required_labels | | federation tests 部分 | | M4-04 | Partial | indexGroupTask 存 required_labels，但 group-tasks 入参仍 required_capabilities |
| F006-AC03 | Poll 接口按 Agent labels 过滤 | | federation tests 部分 | | M8-06~M8-08 | Partial | 需补明确子集匹配自动化 |
| F006-AC04 | required_labels ⊆ agent_labels | | | | M8-06~M8-07 | Manual | 缺枚举型测试 |
| F006-AC05 | 多 Agent 满足条件时返回任务但不指定分配者 | | | | | Missing | |
| F006-AC06 | 信誉分作为排序权重 | | | | | Missing | 未实现 / 可标延期 |

### STORY-F007：群任务队列拉取模式

| AC ID | Acceptance Criterion | Unit | Integration | E2E | Manual | 当前状态 | 发现 |
|-------|----------------------|------|-------------|-----|--------|----------|------|
| F007-AC01 | Hub 维护 federation_task_index | | federation tests 部分 | | M4-04 | Partial | |
| F007-AC02 | GET /api/federation/poll 接受 team_id、agent_labels 参数 | | federation tests 部分 | | M8-06 | Partial | 实现参数名为 `labels`，故事写 `agent_labels` |
| F007-AC03 | Runner 每 5~10 秒 poll | | | | | Missing | |
| F007-AC04 | poll 返回 task_id/title/required_labels/source_team_id | | | | M8-06 | Manual | |
| F007-AC05 | 任务被 claim 后索引状态变 claimed，后续 poll 不返回 | | | | M8-12 | Missing | `POST /api/federation/claim` 当前 mock 返回 |
| F007-AC06 | 离线恢复后 poll 返回错过任务 | | | | | Missing | |

---

## 4. Process / Quality Stories 覆盖矩阵

| Rule | 描述 | 当前覆盖 | 缺口 | Follow-up |
|------|------|----------|------|-----------|
| B-1 | UI story 必须有用户操作入口 AC | 文档已补 | 未纳入模板/CI | STORY-Q001 |
| B-2 | Epic 能力闭环表 | 文档已补 | 旧 sprint 未执行 | STORY-Q001 |
| B-3 | 状态枚举必须有 UI 映射 | 文档已补 | 缺自动化脚本 | STORY-Q001 |
| T-1 | 1 条 AC ↔ ≥1 条断言 | 文档已补 | 缺检查脚本 | STORY-Q001 |
| T-2 | 组件被使用必须断言 | 文档已补 | 缺 orphan component check | STORY-Q001 |
| T-5 | TODO Gate | 文档已补 | 缺 TODO baseline check | STORY-Q001 |

---

## 5. Summary

| 区域 | AC 总数 | Covered | Partial | Manual | Missing | Blocked |
|------|--------|---------|---------|--------|---------|---------|
| G023 Groups UI | 14 | 2 | 4 | 3 | 3 | 2 |
| G024 Task Board | 8 | 0 | 1 | 0 | 7 | 0 |
| G025 Authorizations UI | 6 | 1 | 2 | 2 | 1 | 0 |
| G026 Reputation UI | 4 | 1 | 0 | 0 | 3 | 0 |
| F006 Label Routing | 6 | 0 | 3 | 1 | 2 | 0 |
| F007 Poll Routing | 6 | 0 | 2 | 1 | 3 | 0 |
| **Total** | **44** | **4** | **12** | **7** | **19** | **2** |

**Adjusted TEA Decision:** CONDITIONAL GO  
**Reason:** 自动化测试已通过，但 UI/流程 AC 覆盖率不足，且存在 Blocked/Missing 项。需完成 follow-up stories 或明确延期后再做最终 release GO。

---

## 6. Required Follow-up Stories

- `STORY-G027` — Groups 页面补齐 Leave / Delete / shared_capabilities 编辑
- `STORY-G028` — Agents 页面补齐 labels 输入与展示
- `STORY-G029` — TaskBoard 群任务视觉区分与 pending_authorization 状态
- `STORY-G030` — ReputationBadge 接入 Groups / Authorizations 页面
- `STORY-G031` — Review 工作流 UI
- `STORY-F011` — Federation Peers 状态面板
- `STORY-F012` — Federation claim routing 完整链路
- `STORY-Q001` — BMAD/TEA 质量门禁与 CI 规则
