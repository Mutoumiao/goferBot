# 规格编写规范

> 三层规格：功能规格 → 行为规格 → API 规格
> 所有 spec 文件放在 issue 目录下的 `specs/` 子目录中

---

## 目录结构

```
docs/issues/{prefix}-{NN}-{kebab-slug}/specs/
├── feature-spec.md      # 功能规格（必须）
├── behavior-spec.md     # 行为规格（前端必须）
└── api-spec.md          # API 规格（后端必须）
```

- 纯前端功能（无 API）可省略 `api-spec.md`
- 纯后端功能（无 UI）可省略 `behavior-spec.md`
- 基础设施类 issue 至少包含 `feature-spec.md`

---

## 模板文件

| 规格类型 | 模板位置 | 说明 |
|---------|---------|------|
| 功能规格 | [`_templates/feature-spec.md`](./_templates/feature-spec.md) | 用户故事、边界、决策记录 |
| 行为规格 | [`_templates/behavior-spec.md`](./_templates/behavior-spec.md) | 交互状态、正常流程、错误场景、测试映射 |
| API 规格 | [`_templates/api-spec.md`](./_templates/api-spec.md) | 端点定义、请求/响应示例、错误码、测试映射 |

---

## 编写流程

1. **功能规格先写** — 定义边界，防止范围蔓延
2. **行为规格其次** — 前端交互是用户可见的契约
3. **API 规格最后** — 后端接口支撑前端行为

**审查**：
- 规格编写完成后，使用 `/kb-review` 执行 Spec 对齐审查
- 检查是否覆盖所有交互状态、边界条件和错误场景

**PRD 一致性**：
- 如果 issue 引用了 PRD，spec 必须与 PRD 保持一致
- 优先以 PRD 定义为准
- 如有偏差，在 spec 中显式标注 "PRD 偏差" 并说明原因
- 禁止在 spec 中悄悄修改 PRD 定义而不留痕迹

**禁止**：
- 不写规格直接写计划
- 用 "TODO" 或 "TBD" 填充关键字段
- 一个规格文件描述多个独立功能
- PRD 偏离：spec 与 issue 引用的 PRD 目标不一致且无说明
