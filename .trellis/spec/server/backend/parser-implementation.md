# 文档解析器开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/document/spec.md](../../../../openspec/specs/document/spec.md)（WHAT）。策略模式 / PDF 三重回退 / StructureExtractor 算法 / Zod 校验管线 / EXT_TO_MIME 映射 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在文档解析管线中高效工作：注册新解析器、调试 PDF 后备链、调优结构提取与分块、规避常见陷阱。本文不重复业务规则与接口契约，仅记录面向开发者的操作智慧。

## Primary OpenSpec

- [openspec/specs/document/spec.md](../../../../openspec/specs/document/spec.md) — 文档解析系统级规范

## Related OpenSpec

- [openspec/specs/knowledge-base/spec.md](../../../../openspec/specs/knowledge-base/spec.md) — 知识库文档管理

## Module Dependencies

- `pdf-parse` / `pdfjs-dist` / `@llamaindex/readers` — PDF 解析后备链（动态 `require()` 加载，非硬依赖）
- `zod` — 解析输入/输出校验
- 标准库 `Buffer` / `toString('utf-8')` — 文本解码最终回退

## Development Entry

- `packages/server/src/processors/parser/document.parser.ts` — 解析器入口（register / unregister / parse 调度）
- `packages/server/src/processors/parser/parser.types.ts` — 接口与 Zod schema 类型定义
- `packages/server/src/processors/parser/pdf.parser.ts` — PDF 解析（三重回退链）
- `packages/server/src/processors/parser/text.parser.ts` — 文本解析（Buffer→UTF-8 + StructureExtractor）
- `packages/server/src/processors/parser/structure-extractor.ts` — 结构提取纯函数

## Implementation Notes

### 新解析器注册模式

1. 实现 `IDocumentParser` 接口（`name` / `mimeTypes` / `parse(input)`）
2. 在 `document.parser.ts` 初始化阶段调用 `DocumentParser.register(new XxxParser())`
3. 同步在 OpenSpec `document/spec.md` 的"默认解析器注册表"场景补充声明
4. 若引入新扩展名，需在 `EXT_TO_MIME` 双向同步

### PDF 后备链调试技巧

- **三后端输入要求不同**：LlamaIndex 后端需 `filePath`，未定义时直接降级；`pdf-parse` 需 `buffer`；UTF-8 回退仅对文本型 PDF 有效，二进制 PDF 会产生乱码（预期行为，非 bug）
- **动态 require 加载**：所有后端通过 `require()` 动态加载而非静态 import，避免对 PDF 库的硬依赖；调试 require 抛错时先确认包已安装
- **降级链不可逆**：LlamaIndex 失败后降级到 raw buffer 是单向的，不会回退到 pdf-parse；调试时需沿链路逐级验证而非跳级

### StructureExtractor 状态机调试

- **行级状态机**：按行迭代，两个关键状态切换点 — 围栏代码块（` ```lang `）与标题（`#~###### `）
- **代码块优先**：代码块在标题处理之前提取；代码围栏内的 `#` 不会被误判为标题
- **栈是级别而非路径**：`headingLevels` 存储标题级别（整数），不是标题文本栈；实现错误会导致兄弟节点替换逻辑失效
- **hierarchyPath 设计意图**：累积所有遇到的标题（含兄弟节点）用于 Contextual Embedding，提供更丰富上下文；非当前路径，勿简化为路径栈

### 分块策略调优

- 调整分块参数（chunk size / overlap）时需同步评估对召回率与上下文连贯性的双向影响
- 大文档分块前先验证 StructureExtractor 输出的章节边界是否合理，避免跨章节切分

## Testing Checklist

- [ ] 各解析器正确处理对应 MIME 类型
- [ ] PDF 三重回退链按优先级执行（LlamaIndex → pdf-parse → UTF-8）
- [ ] 结构提取正确识别标题层级（H1/H2/H3 嵌套）
- [ ] 代码围栏内的 `#` 不被误判为标题
- [ ] Zod 校验失败时文档被标记为 `failed`
- [ ] 未识别扩展名正确回退到 UTF-8 文本提取
- [ ] 空文档返回空结构（无章节、无层次路径、无代码块）

## Review Checklist

- [ ] 新增解析器是否同步更新 OpenSpec `document/spec.md`
- [ ] EXT_TO_MIME 映射变更是否同步更新 OpenSpec
- [ ] 分块策略变更是否同步更新 OpenSpec
- [ ] 新增 MIME 类型是否在 `mimeIndex` 与 `EXT_TO_MIME` 双向同步
- [ ] 动态 require 的依赖是否在 package.json 中声明

## Common Pitfalls

- **二进制 PDF 乱码**：UTF-8 回退仅对文本型 PDF 有效，扫描件/图片型 PDF 会产生乱码 — 这是预期行为，需在上游引入 OCR
- **静态 import PDF 库**：硬依赖会破坏后备链设计；必须用 `require()` 动态加载
- **栈实现混淆**：将 `headingLevels` 实现为标题文本栈而非级别栈，会导致兄弟节点替换与后代清理逻辑错误
- **代码块提取顺序**：若在标题处理之后提取代码块，围栏内的 `#` 会被误判为标题
- **EXT_TO_MIME 漏更新**：新增解析器时仅在 `mimeIndex` 注册而忘记更新 `EXT_TO_MIME`，导致文件名分派失效
- **Zod 校验绕过**：直接调用底层解析器绕过 `DocumentParser.parse()` 会跳过校验，导致 `failed` 标记缺失
- **LlamaIndex 输入缺失**：调用 PDF 解析时未传 `filePath`，导致 LlamaIndex 后端直接降级，掩盖真实性能问题

## Reusable Patterns

- **策略模式可插拔解析器**：register/unregister + mimeIndex 索引，适用于任何按类型分派的可扩展管线
- **PDF 后备链模式**：动态 require + 单向降级，适用于可选依赖较多、需运行时探活的场景
- **行级状态机解析模式**：逐行迭代 + 状态切换（代码围栏/标题），适用于结构化文本提取
