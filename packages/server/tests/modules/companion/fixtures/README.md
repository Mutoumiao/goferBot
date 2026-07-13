# Companion 规则引擎黄金 Fixture

> 对应 OpenSpec change `companion-parity-ai-partner-agent` task **1.2**  
> 测试 ID 与 `openspec/changes/companion-parity-ai-partner-agent/gap-matrix.md` 对齐。

## 命名约定

| 前缀 | 含义 | 位置 |
|------|------|------|
| `UT-RT-*` | Route 规则匹配 | `route-cases.json` + `route-rules.golden.spec.ts` |
| `UT-PL-*` | Policy 策略包 | 后续 `policy-cases.json`（由 route 推导） |
| `UT-QL-*` | Quality 违规/status | `quality-cases.json` + `quality-guard.golden.spec.ts` |
| `UT-MEM-skip-*` | 记忆关键词/跳过 | `memory-skip-cases.json` + `memory-skip.golden.spec.ts` |
| `UT-FB-*` / `UT-MD-*` | 反馈/metadata 纯逻辑 | 随 2.x 补 |
| `IT-*` | 集成测 | 仓库根 `tests/integration/companion-*.spec.ts` |

用例字段：

```json
{
  "id": "UT-QL-label-leak",
  "description": "内部标签泄露 → fail",
  "input": {},
  "expect": {}
}
```

- **id** 必须全局唯一，与 gap-matrix 测试 ID 一致。
- 实现阶段扩展 cases 时先改 JSON，再改断言映射。

## 运行

```bash
# 在 packages/server
pnpm test -- tests/modules/companion
```
