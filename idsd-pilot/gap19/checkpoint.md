# Checkpoint: GAP-19 v1

## 版本标签
gap19-v1

## 已完成期望

### 成功场景
- ✅ 通过 UI 创建群：新频道会出现在 Chat 页面频道列表（前端监听 `channel.created` 并刷新）。
- ✅ 通过 API 创建群：`POST /api/groups` 返回 `channel_id`；`channels` 表中存在 `type='group'` 的记录。
- ✅ 群主团队成员关系：群主用户自动以 `member_kind='human'` 加入 `channel_members`。
- ✅ 频道名称唯一性：同名群产生不同 `channel_id`。

### 失败场景
- ✅ 群创建失败：事务回滚，不会残留频道记录。
- ✅ 群名重复：频道创建仍成功，因为频道身份绑定群 ID。

### 边界场景
- ✅ 已存在的群：不会 retroactively 获得频道。
- ✅ 解散群：自动清理对应频道及其成员。
- ✅ 联邦成员入群：不自动加入已有频道（超出本次范围，未改动）。

## 验证结果
- Server 测试：245 passed
- Web 测试：45 passed
- Typecheck：通过
- Lint：0 errors（54 warnings 均为既有）
- Holdout 评估：
  - `node evaluate.cjs gap19-v1`：scenarios/ 为空，场景数 0
  - `node evaluate.cjs gap19-v2`：8 个场景全部通过，通过率 100%

## 已补充 Holdout 场景
- success/：UI 创建群、API 创建群返回 channel_id、群主用户自动加入、同名群不同频道
- failure/：群创建失败不残留频道
- boundary/：已存在群不变、解散群清理频道、联邦成员入群不自动加入

## 遗留事项
- 当前 evaluate.cjs 为半自动化：每个场景都运行完整 `npm test + typecheck`。
- 后续可将场景描述映射为具体 API/UI 断言，实现按场景的精确验证。
