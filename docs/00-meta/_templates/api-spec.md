# API 规格模板（后端）

```markdown
---
issue_id: {issue-id}
type: api-spec
status: draft
summary: {端点列表、核心 DTO、关键错误场景，2-3 句话}
---

# API 规格：{功能名称}

## 端点

### POST /api/{资源}

#### 认证
{Bearer Token / 无 / 等}

#### 请求
```json
{
  "field": "type (constraints)"
}
```

#### 响应 200/201
```json
{
  "field": "type"
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|------|----------|---------------|
| 400 | {场景} | `{ "error": "..." }` |
| 409 | {场景} | `{ "error": "..." }` |

#### 异步行为
- {异步发生什么}
- {客户端如何轮询状态}
```

---

## Frontmatter 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `issue_id` | 对应 issue 编号 | ✅ |
| `type` | 固定值：`api-spec` | ✅ |
| `status` | draft → review → approved → deprecated | ✅ |
| `summary` | 清晰描述 API 范围与核心端点，Agent 据此判断是否需深入阅读 | ✅ |

## 关键规则

- 每个端点必须有请求/响应示例
- 每个错误码必须有触发场景
- 异步行为必须说明客户端如何获取状态更新
