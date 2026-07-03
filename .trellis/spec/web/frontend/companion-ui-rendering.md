# Companion 前端 UI 渲染

> Companion 模块的前端 UI 组件树、渲染模式和使用约定。

---

## 组件树

```
CompanionListPage                     ← 列表页（/companions）
├── Tabs（全部/草稿/已发布/已归档）      ← 四态筛选
├── Grid（1-4列响应式）
│   └── CompanionCard                 ← 每张卡片
│       ├── 头像（图片/首字母）
│       ├── CompanionStatusTag
│       └── DropdownMenu（编辑/删除）
├── CompanionForm（Dialog）            ← 创建/编辑表单
└── AlertDialog（删除确认）

CompanionChatPage                     ← 聊天页（/companions/$id/chat）
├── CompanionHeader                   ← 固定顶部
│   ├── 返回 + 头像 + 名称 + StatusTag
│   └── "记忆库" 按钮 → /companions/$id/memories
├── 消息滚动区（overflow-y-auto）
│   ├── [空状态] Empty + CompanionQuickPrompts
│   └── [有消息] CompanionMessageItem[]
│       ├── 用户消息: plain text（placement=end, variant=filled）
│       └── AI 消息: XMarkdown（静态）+ 点赞/踩反馈
│           └── [流式中] CompanionTypingIndicator 覆写 content
└── Sender（固定底部）
```

共 **10 个组件**，覆盖完整的 CRUD + 对话交互。

---

## 打字机动画

### CompanionTypingIndicator

与 Chat 的 `XMarkdown streaming.hasNextChunk` 完全不同，Companion 使用自己的逐字打字机：

```typescript
// packages/web/src/features/companion/components/CompanionTypingIndicator.tsx

const DEFAULT_INTERVAL = 18  // 18ms/字

function CompanionTypingIndicator({ content, intervalMs, onComplete }) {
  const [displayedCount, setDisplayedCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayedCount((prev) => {
        const next = prev + 1
        if (next >= content.length) { clearInterval(timer) }
        return next
      })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [content, displayedCount])

  return (
    <span>
      {content.slice(0, displayedCount)}
      {displayedCount < content.length && (
        <span className="animate-pulse w-0.5 h-4 bg-current" />  // 闪烁光标
      )}
    </span>
  )
}
```

**关键细节**：
- 默认 18ms 间隔（约 55 字/秒，模拟真人中等打字速度）
- 尾部闪烁光标用 `animate-pulse` CSS 实现
- content 变长后触发重渲染，光标推进
- `onComplete` 在全部文字显示后触发

### 与 Chat XMarkdown 对比

| 特性 | CompanionTypingIndicator | XMarkdown streaming |
|------|------------------------|---------------------|
| 渲染策略 | 纯文本逐字输出 | Markdown 增量渲染 |
| 动画方式 | setInterval + displayedCount | hasNextChunk 光标 |
| 光标样式 | `animate-pulse` 闪烁竖线 | XMarkdown 内置光标 |
| 适用 | 纯文本（模拟真人） | Markdown（代码、表格） |

---

## 消息气泡组件

### CompanionMessageItem 三态渲染

[CompanionMessageItem.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/companion/components/CompanionMessageItem.tsx) 使用 `@ant-design/x` 的 `Bubble` 组件：

| 消息角色 | 渲染内容 | Bubble 配置 | 反馈 |
|---------|---------|------------|------|
| 用户消息 | 纯文本 `message.content` | `placement=end, variant=filled, shape=round` | 无 |
| AI 流式中 | `<CompanionTypingIndicator content={message.content} />` | `placement=start, variant=borderless, shape=round` | 无 |
| AI 完成 | `<XMarkdown content={message.content} streaming={{ hasNextChunk: false }} />` | `placement=start, variant=borderless, shape=round` | 点赞/踩 |

### 反馈按钮

AI 完成消息显示点赞/踩按钮，带悬停动画：

```tsx
// group-hover 显示，已投票按钮高亮
<div className="opacity-0 group-hover:opacity-100 transition-opacity">
  <Button
    variant={message.feedback?.rating === 'up' ? 'secondary' : 'ghost'}
    onClick={() => onFeedback(message.id, 'up')}
  >
    <ThumbsUp />
  </Button>
  <Button
    variant={message.feedback?.rating === 'down' ? 'secondary' : 'ghost'}
    onClick={() => onFeedback(message.id, 'down')}
  >
    <ThumbsDown />
  </Button>
</div>
```

**交互细节**：
- 默认 `opacity-0`，父元素 `group hover` 时 `opacity-100`
- 已投票按钮 `variant='secondary'` 高亮
- 点击调用 `submitFeedback(messageId, { rating: 1 | -1 })`
- 流式中不显示反馈按钮

---

## 头像渲染模式

Card 和 Header 共用相同的头像逻辑：

```tsx
<div
  style={{
    backgroundImage: companion.avatarKey
      ? `url(/api/files/${companion.avatarKey})`
      : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
>
  {!companion.avatarKey && companion.name.charAt(0)}
</div>
```

**渲染规则**：
- 有 `avatarKey` → CSS `backgroundImage` 加载 `/api/files/{key}`
- 无 `avatarKey` → 首字母 fallback（`.charAt(0)` 居中显示）
- Card 尺寸：`h-14 w-14`，Header 尺寸：`h-10 w-10`

---

## CompanionForm 表单

### 11 字段

| 字段 | 组件 | 必填 | 说明 |
|------|------|------|------|
| `name` | Input | 是 | 伴侣名称 |
| `headline` | Input | 否 | 卡片副标题 |
| `description` | Textarea(3行) | 否 | 详细描述 |
| `personality` | Input | 否 | 性格设定 |
| `tone` | Input | 否 | 语气风格 |
| `boundaries` | Textarea(2行) | 否 | 行为边界 |
| `guardrailsPrompt` | Textarea(2行) | 否 | 安全约束提示词 |
| `defaultPrompt` | Textarea(2行) | 否 | 默认系统提示词 |
| `backgroundStory` | Textarea(3行) | 否 | 背景故事 |
| `openingMessage` | Textarea(2行) | 否 | 开场白 |
| `avatarKey` | Input | 否 | 头像文件 key |
| `visibility` | Input | 否 | 可见性 |

**提交处理**：所有字段 `trim()` 处理，空字符串转 `undefined`。

**双模式**：通过 `mode: 'create' | 'edit'` prop 切换
- create → `POST /api/companions` → toast "创建成功"
- edit → `PATCH /api/companions/{id}` → toast "更新成功"

### CompanionStatusTag 三态

| 状态 | Badge variant | 中文标签 |
|------|-------------|---------|
| `draft` | `default` | 草稿 |
| `published` | `secondary` | 已发布 |
| `archived` | `destructive` | 已归档 |

---

## 数据模型

### CompanionMessage（前端专有）

```typescript
// packages/web/src/features/companion/types.ts
interface CompanionMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  streaming?: boolean                                           // 流式标记
  feedback?: { rating: 'up' | 'down', comment?: string } | null  // 用户反馈
}
```

比后端 `Message` 多出 `streaming` 和 `feedback` 两个前端状态字段。

### Memory 类型

```typescript
type MemoryType =
  | 'preference'          // 偏好
  | 'boundary'            // 边界
  | 'relationship_goal'   // 关系目标
  | 'conversation_style'  // 对话风格
  | 'important_fact'      // 重要事实

const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  preference: '偏好',
  boundary: '边界',
  relationship_goal: '关系目标',
  conversation_style: '对话风格',
  important_fact: '重要事实',
}
```

5 种记忆类型，用于 Companion 记忆管理页面。

---

## 页面导航

| 路径 | 组件 | 说明 |
|------|------|------|
| `/companions` | `CompanionListPage` | 伴侣列表页面 |
| `/companions/$companionId/chat` | `CompanionChatPage` | 伴侣聊天页面 |
| `/companions/$companionId/memories` | `CompanionMemoriesPage` | 伴侣记忆管理 |

---

## 代码引用

| 组件 | 文件路径 |
|------|----------|
| CompanionTypingIndicator | `packages/web/src/features/companion/components/CompanionTypingIndicator.tsx` |
| CompanionMessageItem | `packages/web/src/features/companion/components/CompanionMessageItem.tsx` |
| CompanionChatPage | `packages/web/src/features/companion/components/CompanionChatPage.tsx` |
| CompanionListPage | `packages/web/src/features/companion/components/CompanionListPage.tsx` |
| CompanionCard | `packages/web/src/features/companion/components/CompanionCard.tsx` |
| CompanionForm | `packages/web/src/features/companion/components/CompanionForm.tsx` |
| CompanionHeader | `packages/web/src/features/companion/components/CompanionHeader.tsx` |
| CompanionQuickPrompts | `packages/web/src/features/companion/components/CompanionQuickPrompts.tsx` |
| CompanionStatusTag | `packages/web/src/features/companion/components/CompanionStatusTag.tsx` |
| 类型定义 | `packages/web/src/features/companion/types.ts` |
