---
{
  "checks": [
    {
      "name": "缺 owner_group_id 创建域被拒",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "NoOwner-Domain" },
      "expect": { "status": 400 }
    },
    {
      "name": "缺 name 创建域被拒",
      "method": "POST",
      "url": "/api/domains",
      "body": { "owner_group_id": "group-nonexistent" },
      "expect": { "status": 400 }
    }
  ]
}
---
# 边界场景：创建域参数校验

## 操作
1. 缺 owner_group_id 创建域。
2. 缺 name 创建域。

## 期望
- 均返回 400（参数校验，与 groups API 一致）。
