# 跨层思考指南

> **目的**：在实现前先梳理跨层的数据流向。

---

## 问题所在

**大多数 Bug 发生在层边界处**，而不是层内部。

常见的跨层 Bug：

- API 返回格式 A，前端期望格式 B
- 数据库存储 X，服务转换为 Y，但丢失了数据
- 多个层以不同方式实现相同逻辑

---

## 实现跨层功能之前

### 步骤 1：绘制数据流

画出数据如何流动：

```
Source → Transform → Store → Retrieve → Transform → Display
```

对于每个箭头，问自己：

- 数据是什么格式？
- 可能出什么问题？
- 谁负责验证？

### 步骤 2：识别边界

| 边界                  | 常见问题                         |
| --------------------- | -------------------------------- |
| API ↔ Service         | 类型不匹配，缺失字段             |
| Service ↔ Database    | 格式转换，空值处理               |
| Backend ↔ Frontend    | 序列化，日期格式                 |
| Component ↔ Component | Props 形状变化                   |

### 步骤 3：定义契约

对于每个边界：

- 精确的输入格式是什么？
- 精确的输出格式是什么？
- 可能发生什么错误？

---

## 常见跨层错误

### 错误 1：隐式格式假设

**坏**：假设日期格式而不检查

**好**：在边界处显式进行格式转换

### 错误 2：分散的验证

**坏**：在多个层中验证同一件事

**好**：在入口点验证一次

### 错误 3：泄漏的抽象

**坏**：Component 知道数据库 schema

**好**：每个层只知道它的相邻层

### 错误 4：每个消费者都解析相同的 Payload

**坏**：一个命令读取 JSONL 事件并内联转换字段：

```typescript
const thread = (ev as { thread?: string }).thread;
const labels = (ev as { labels?: string[] }).labels;
```

这看起来是局部的，但意味着每个消费者都拥有事件契约的私有版本。下一次字段更改会更新一个命令，但遗漏另一个。

**好**：在事件边界处解码一次，然后导出类型化的投影：

```typescript
if (!isThreadEvent(ev)) return false;
return ev.thread === filter.thread;
```

**规则**：对于追加式日志、JSON 流、RPC payload 或配置文件，为以下内容创建一个所有者：

- event / payload 类型定义
- 从 `unknown` 进行类型守卫和规范化
- UI 命令使用的元数据投影
- 从真实来源重放状态的 reducer

渲染代码可以格式化字段，但不得重新定义 payload 契约。

---

## 跨层功能检查清单

实现之前：

- [ ] 绘制完整的数据流
- [ ] 识别所有层边界
- [ ] 定义每个边界的格式
- [ ] 决定验证发生在哪里

实现之后：

- [ ] 使用边缘案例测试（null、空、无效）
- [ ] 验证每个边界的错误处理
- [ ] 检查数据往返后是否保持完整
- [ ] 检查消费者是否导入共享的解码器 / 投影，而不是
      在本地转换 payload 字段
- [ ] 检查派生状态是否指向源事件标识符
      （`seq`、`id`、`version`），而不是创建第二个游标

---

## 跨平台模板一致性

在 Trellis 中，命令模板（如 `record-session.md`）存在于**多个平台**，内容完全相同或几乎相同。这是一个跨层边界。

### 检查清单：修改任何命令模板后

- [ ] 找到使用相同命令的所有平台：`find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] 更新所有平台副本（Markdown `.md` 和 TOML `.toml`）
- [ ] 对于 Gemini TOML：调整行延续符（`\\` vs `\`）和三引号字符串
- [ ] 运行 `/trellis:check-cross-layer` 验证没有遗漏任何内容

**真实案例**：在 Claude 中更新 `record-session.md` 使用 `--mode record`，但忘记了 iFlow、Kilo、OpenCode 和 Gemini —— 被跨层检查捕获。

---

## 生成的运行时模板升级一致性

有些生成的文件既是文档又是运行时输入。在 Trellis 中，
`.trellis/workflow.md` 被 `get_context.py`、`workflow_phase.py`、
SessionStart 过滤器和每轮钩子解析。模板更改必须针对
全新初始化和升级路径进行验证。

### 检查清单：修改运行时解析模板后

- [ ] 识别每个读取模板的运行时解析器，而不仅仅是
      安装它的文件写入器
- [ ] 检查相关语法是否存在于明显的托管区域之外，
      例如标签块
- [ ] 验证全新 `init` 输出和写入旧版本 `.trellis/.version` 的
      版本化 `update` 场景
- [ ] 使用旧的原始模板 fixture 添加升级回归测试，然后
      断言安装的文件达到当前打包的形状
- [ ] 更新拥有运行时契约的后端规范

---

## 版本化文档边界

版本化文档是一个跨层边界：源路径、`docs.json`
版本路由和渲染的版本选择器必须都描述相同的
发布线。

### 检查清单：编辑版本化文档之前

- [ ] 确定目标发布线：stable、beta 或 RC
- [ ] 验证编辑的 MDX 路径匹配该线：
  - stable：`docs-site/{start,advanced,...}` 和 `docs-site/zh/{start,advanced,...}`
  - beta：`docs-site/beta/**` 和 `docs-site/zh/beta/**`
  - RC：`docs-site/rc/**` 和 `docs-site/zh/rc/**`
- [ ] 验证 `docs.json` 导航将版本标签指向相同的路径
- [ ] 在提交前 grep 相反的树查找发布线特定术语
- [ ] 将出现在根发布路径下的 beta 内容视为源路径 bug，
      而不是渲染 bug

**真实案例**：一个仅限 beta 的任务工作流更改在根 `start/` 和 `advanced/` 路径下记录了
`prd.md` + `design.md` + `implement.md`、任务创建同意和 Codex
模式横幅。然后文档站点在 Release 选择器下提供了 0.6 beta 行为。修复方法是恢复根
发布文档，将 0.6 内容移到 `beta/` 和 `zh/beta/`，并添加 grep
审核以检查根发布树中的 beta 标记。

**真实案例**：Codex 内联模式将工作流平台标记从
`[Codex]` / `[Kilo, Antigravity, Windsurf]` 更改为 `[codex-sub-agent]` /
`[codex-inline, Kilo, Antigravity, Windsurf]`。全新初始化是正确的，但
`trellis update` 只合并了 `[workflow-state:*]` 块，并保留了这些块之外的陈旧
标记。结果：升级后的项目获得了新的钩子脚本
但旧的工作流路由，因此 `get_context.py --mode phase --platform codex`
可能返回空的 Phase 2.1 细节。

---

## 模式检测探针检查清单

当 CLI 通过探测远程资源自动检测模式时（例如，检查 `index.json` 是否存在以决定 marketplace 还是直接下载）：

### 实现之前：

- [ ] 探针在**所有**使用结果的代码路径中运行（交互式、`-y`、`--flag` 组合）
- [ ] 区分 404 和瞬时错误 —— 不要将两者都视为"未找到"
- [ ] 瞬时错误**中止或重试**，绝不静默切换模式
- [ ] 当上下文变化时（例如，用户切换源），共享状态（缓存、预取数据）被**重置**
- [ ] **快捷路径**（例如，`--template` 跳过选择器）必须具有与探测路径相同的错误处理质量 —— 检查下游函数不调用 catch-all 包装器

### 实现之后：

- [ ] 跟踪从探针结果到模式决策分支的每条路径 —— 无 fallthrough
- [ ] 外部格式契约（giget URI、原始 URL）经过测试，或至少作为注释记录
- [ ] 元数据读取消费完整响应或使用流式解析器 —— 绝不将固定大小的前缀解析为完整 JSON
- [ ] 从解析的部分重建复合标识符时，验证**所有**字段都包含在内且处于**正确位置**（例如，`provider:repo/path#ref` 而非 `provider:repo#ref/path`）
- [ ] 验证快捷方式后调用的**动作函数**不内部使用旧的 catch-all fetch —— 当错误区分很重要时，它们必须使用探针质量的变体

**真实案例**：自定义注册表流程在 3 轮审查中有 8 个 bug：(1) 探针仅在交互式模式下运行，(2) 瞬时错误 fallthrough 到错误模式，(3) giget URI 的 `#ref` 位置错误，(4) 预取模板在源切换之间泄漏，(5) `--template` 快捷方式绕过了探针，但 `downloadTemplateById` 内部使用 catch-all `fetchTemplateIndex`，将超时变为"模板未找到"。

**真实案例**：Agent-session 更新提示使用 `response.read(4096)` 获取 npm `latest` 元数据，然后将其解析为完整 JSON。`@mindfoldhq/trellis` 包元数据超过 4 KB，因此 JSON 被截断，解析静默失败，第一次会话注入没有显示更新提示。修复：在解析前读取完整响应，并添加一个回归测试，其中 `version` 后面跟着 8 KB 的元数据尾部。

---

## 跨平台模板一致性

在 Trellis 中，命令模板（如 `record-session.md`）存在于**多个平台**，内容完全相同或几乎相同。这是一个跨层边界。

### 检查清单：修改任何命令模板后

- [ ] 找到使用相同命令的所有平台：`find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] 更新所有平台副本（Markdown `.md` 和 TOML `.toml`）
- [ ] 对于 Gemini TOML：调整行延续符（`\\` vs `\`）和三引号字符串
- [ ] 运行 `/trellis:check-cross-layer` 验证没有遗漏任何内容

**真实案例**：在 Claude 中更新 `record-session.md` 使用 `--mode record`，但忘记了 iFlow、Kilo、OpenCode 和 Gemini —— 被跨层检查捕获。

---

## 生成的运行时模板升级一致性

有些生成的文件既是文档又是运行时输入。在 Trellis 中，
`.trellis/workflow.md` 被 `get_context.py`、`workflow_phase.py`、
SessionStart 过滤器和每轮钩子解析。模板更改必须针对
全新初始化和升级路径进行验证。

### 检查清单：修改运行时解析模板后

- [ ] 识别每个读取模板的运行时解析器，而不仅仅是
  安装它的文件写入器
- [ ] 检查相关语法是否存在于明显的托管区域之外，
  例如标签块
- [ ] 验证全新 `init` 输出和写入旧版本 `.trellis/.version` 的
  版本化 `update` 场景
- [ ] 使用旧的原始模板 fixture 添加升级回归测试，然后
  断言安装的文件达到当前打包的形状
- [ ] 更新拥有运行时契约的后端规范

**真实案例**：Codex 内联模式将工作流平台标记从
`[Codex]` / `[Kilo, Antigravity, Windsurf]` 更改为 `[codex-sub-agent]` /
`[codex-inline, Kilo, Antigravity, Windsurf]`。全新初始化是正确的，但
`trellis update` 只合并了 `[workflow-state:*]` 块，并保留了这些块之外的陈旧
标记。结果：升级后的项目获得了新的钩子脚本
但旧的工作流路由，因此 `get_context.py --mode phase --platform codex`
可能返回空的 Phase 2.1 细节。

---

## 模式检测探针检查清单

当 CLI 通过探测远程资源自动检测模式时（例如，检查 `index.json` 是否存在以决定 marketplace 还是直接下载）：

### 实现之前：
- [ ] 探针在**所有**使用结果的代码路径中运行（交互式、`-y`、`--flag` 组合）
- [ ] 区分 404 和瞬时错误 —— 不要将两者都视为"未找到"
- [ ] 瞬时错误**中止或重试**，绝不静默切换模式
- [ ] 当上下文变化时（例如，用户切换源），共享状态（缓存、预取数据）被**重置**
- [ ] **快捷路径**（例如，`--template` 跳过选择器）必须具有与探测路径相同的错误处理质量 —— 检查下游函数不调用 catch-all 包装器

### 实现之后：
- [ ] 跟踪从探针结果到模式决策分支的每条路径 —— 无 fallthrough
- [ ] 外部格式契约（giget URI、原始 URL）经过测试，或至少作为注释记录
- [ ] 元数据读取消费完整响应或使用流式解析器 —— 绝不将固定大小的前缀解析为完整 JSON
- [ ] 从解析的部分重建复合标识符时，验证**所有**字段都包含在内且处于**正确位置**（例如，`provider:repo/path#ref` 而非 `provider:repo#ref/path`）
- [ ] 验证快捷方式后调用的**动作函数**不内部使用旧的 catch-all fetch —— 当错误区分很重要时，它们必须使用探针质量的变体

**真实案例**：自定义注册表流程在 3 轮审查中有 8 个 bug：(1) 探针仅在交互式模式下运行，(2) 瞬时错误 fallthrough 到错误模式，(3) giget URI 的 `#ref` 位置错误，(4) 预取模板在源切换之间泄漏，(5) `--template` 快捷方式绕过了探针，但 `downloadTemplateById` 内部使用 catch-all `fetchTemplateIndex`，将超时变为"模板未找到"。

**真实案例**：Agent-session 更新提示使用 `response.read(4096)` 获取 npm `latest` 元数据，然后将其解析为完整 JSON。`@mindfoldhq/trellis` 包元数据超过 4 KB，因此 JSON 被截断，解析静默失败，第一次会话注入没有显示更新提示。修复：在解析前读取完整响应，并添加一个回归测试，其中 `version` 后面跟着 8 KB 的元数据尾部。

---

## 共享标识符契约检查清单

当一个标识符格式（如 `{providerId}#{modelName}`）被多层代码共享使用时，必须有一个权威所有者，禁止各层各自实现。

### 检查清单：引入跨层共享标识符后

- [ ] **有权威所有者**：标识符的解析/构造函数在某一层定义（如 `@goferbot/data` 或 server 服务层），其他层 import 使用，不自实现
- [ ] **不硬编码分隔符**：所有层通过常量（如 `MODEL_KEY_SEPARATOR`）引用分隔符，不写死 `'#'`
- [ ] **前端解析不重写**：前端 UI 组件（如 Cascader 的 path ↔ key 转换）复用权威解析函数，不重新 split/join
- [ ] **向后兼容**：解析函数处理旧格式（如纯 providerId 无 `#` 部分），不假设总是完整格式
- [ ] **测试覆盖边界**：至少覆盖：完整格式、旧格式（无 `#`）、空值、多层 `#`、特殊字符

**真实案例**：Provider/Model 重构中，`{providerId}#{modelName}` 格式在 server（`parseModelKey`/`buildModelKey`）、admin（`ProviderModelCascader` 的 `keyToPath`/`buildOptions`）、web（`fetchProviders` 中直接拼接）三层各有一套实现。首次实现时三处一致，但后续若格式演进（如增加维度信息），不同步更新会导致运行时解析失败。修复方式：将 `parseModelKey`/`buildModelKey`/`MODEL_KEY_SEPARATOR` 下沉到 `@goferbot/data` 共享契约层。

---

## 何时创建流程文档

在以下情况下创建详细的流程文档：

- 功能跨越 3 个或更多层
- 涉及多个团队
- 数据格式复杂
- 功能之前导致过 Bug

---

## 事件日志 / 投影边界

追加式日志是跨层契约。单个事件经过以下路径：

```
CLI input → event writer → events.jsonl → reader → filter → reducer → display
```

### 检查清单：添加新的事件类型或字段后

- [ ] 将事件类型添加到中央事件分类法
- [ ] 在事件层添加类型化事件变体或类型守卫
- [ ] 为来自用户输入或 JSON 的数组/对象字段添加规范化辅助函数
- [ ] 将 `seq` / `id` 分配仅保留在事件写入器中
- [ ] 让过滤器和 reducer 使用类型化事件守卫，而不是本地转换
- [ ] 让显示代码使用 reducer 输出或类型化事件，而不是原始 JSON
- [ ] 添加至少一个回归测试，证明历史重放和实时过滤使用相同的过滤模型

**真实案例**：线程通道添加了 `kind: "thread"`、`description`、
`context`、labels 和 `lastSeq`。第一次实现正确重放了线程
状态，但几个命令仍然使用本地转换重新解析事件 payload 字段。修复方法是让核心事件层拥有 `ThreadChannelEvent`
和 `isThreadEvent`，让 `reduceChannelMetadata` 成为唯一的通道元数据
投影，并让 `reduceThreads` 成为唯一的线程重放 reducer。