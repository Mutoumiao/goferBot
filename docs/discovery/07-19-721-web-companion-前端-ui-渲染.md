# GoferBot Discovery Report

## 7. 复杂模块

### 7.21 Web Companion 前端 UI 渲染

> **解决**: c9-4 Web Companion 前端 UI 渲染

Companion 前端采用 **10 个组件** 组成完整的 CRUD + 对话 UI，与 Chat 模块使用完全不同的流式渲染策略。

#### 组件树和交互流

```
CompanionListPage                     ← 列表页（/companions）
├── Tabs（全部/草稿/已发布/已归档）      ← 四态筛选
├── Grid（1-4列响应式）                 ← 卡片布局
│   └── CompanionCard                 ← 每张卡片
│       ├── 头像（图片/首字母）         ← CSS backgroundImage + fallback
│       ├── CompanionStatusTag        ← 状态徽章
│       └── DropdownMenu（编辑/删除）   ← 更多操作
├── CompanionForm（Dialog）            ← 创建/编辑表单
└── AlertDialog（删除确认）             ← 二次确认

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
└── Sender（固定底部）                  ← enter 发送, autoSize 3-6行
```

#### 打字机动画 vs XMarkdown 流式渲染

Companion 和 Chat 使用了两种完全不同的流式渲染策略：

| 维度 | Companion | Chat |
|------|-----------|------|
| 渲染引擎 | `CompanionTypingIndicator` | `XMarkdown streaming.hasNextChunk` |
| 技术方案 | `setInterval(18ms)` + `useState(displayedCount)` | `@ant-design/x-markdown` 内置 SSE 流式 |
| 动画效果 | 逐字显示 + 尾部闪烁光标 `animate-pulse` | Markdown 增量渲染 + 光标动画 |
| 完成回调 | `onComplete()` | XMarkdown 自动管理 |
| 适用场景 | 纯文本逐字输出（模拟真人打字） | Markdown 增量渲染（代码块、表格等） |

```typescript
// CompanionTypingIndicator — 逐字打字机（18ms/字）
// packages/web/src/features/companion/components/CompanionTypingIndicator.tsx
useEffect(() => {
  const timer = setInterval(() => {
    setDisplayedCount((prev) => {
      const next = prev + 1
      if (next >= content.length) { clearInterval(timer) }
      return next
    })
  }, intervalMs)  // 默认 18ms
}, [content, displayedCount])

// 渲染: 已显示文字 + 闪烁光标
{content.slice(0, displayedCount)}
{displayedCount < content.length && (
  <span className="animate-pulse w-0.5 h-4 bg-current" />
)}
```

#### 消息气泡组件

[CompanionMessageItem.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/companion/components/CompanionMessageItem.tsx) 根据消息状态决定渲染方式：

| 消息角色 | 渲染内容 | Bubble 配置 | 反馈按钮 |
|---------|---------|------------|---------|
| 用户消息 | 纯文本 `message.content` | `placement=end, variant=filled` | 无 |
| AI 消息（流式中） | `<CompanionTypingIndicator content={message.content} />` | `placement=start, variant=borderless` | 无 |
| AI 消息（完成） | `<XMarkdown content={message.content} streaming={{ hasNextChunk: false }} />` | `placement=start, variant=borderless` | 点赞/踩（group-hover 显示） |

**反馈机制**: `group-hover:opacity-100 transition-opacity` 悬停显示点赞/踩按钮，已投票按钮高亮 `variant='secondary'`，调用 `submitFeedback(messageId, {rating: 1|-1})` 提交。

#### 数据模型

```typescript
// packages/web/src/features/companion/types.ts

// Companion 实体（完整角色属性）
interface Companion {
  id, name, headline?, description?, personality?, tone?,
  boundaries?, guardrailsPrompt?, defaultPrompt?, avatarKey?,
  backgroundStory?, openingMessage?, visibility?,
  status: 'draft' | 'published' | 'archived'
  lastAssistantMessage?, createdAt, updatedAt
}

// 前端消息（比后端 Message 多了 streaming + feedback）
interface CompanionMessage {
  id, conversationId, content, createdAt
  role: 'user' | 'assistant' | 'system'
  streaming?: boolean                          // 标记流式中
  feedback?: { rating: 'up'|'down', comment? } // 用户反馈
}

// 5 种记忆类型（中文标签）
type MemoryType = 'preference' | 'boundary' | 'relationship_goal'
  | 'conversation_style' | 'important_fact'
```

#### CompanionForm 11 字段

| 字段 | 组件 | 说明 |
|------|------|------|
| `name` | Input | 唯一必填 |
| `headline` | Input | 卡片副标题 |
| `description` | Textarea(3行) | 详细描述 |
| `personality` | Input | 性格设定 |
| `tone` | Input | 语气风格 |
| `boundaries` | Textarea(2行) | 行为边界 |
| `guardrailsPrompt` | Textarea(2行) | 安全约束提示词 |
| `defaultPrompt` | Textarea(2行) | 默认系统提示词 |
| `backgroundStory` | Textarea(3行) | 背景故事 |
| `openingMessage` | Textarea(2行) | 开场白 |
| `avatarKey` | Input | 头像文件 key |
| `visibility` | Input | 可见性 |

所有字段 `trim()` 处理，空字符串转 `undefined`。create/edit 双模式通过 `mode` prop 切换。

#### 头像渲染

两个位置共用相同的头像逻辑（Card + Header）：

```typescript
// CSS backgroundImage 模式 — 有图片时用图片，无图片时首字母 fallback
<div style={{
  backgroundImage: companion.avatarKey
    ? `url(/api/files/${companion.avatarKey})`
    : undefined,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}}>
  {!companion.avatarKey && companion.name.charAt(0)}
</div>
```

#### CompanionStatusTag 三态映射

| 状态 | Badge variant | 中文标签 |
|------|-------------|---------|
| `draft` | `default` | 草稿 |
| `published` | `secondary` | 已发布 |
| `archived` | `destructive` | 已归档 |

---
