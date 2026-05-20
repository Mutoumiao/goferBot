# 文档流程重构方案：Issue-Centric 扁平化改造

> 状态：待评审
> 日期：2026-05-20
> 背景：`02-issues/` `03-specs/` `04-plans/` 目录分散、命名混乱、维护困难

---

## 1. 核心问题

| 问题 | 表现 |
|------|------|
| 目录分散 | issue、spec、plan 分属三个目录，找文件跳转成本高 |
| 命名混乱 | `f-15-global-tab-bar.md` vs `f-15/` vs `v1.md`，无统一模式 |
| 状态漂移 | issue checklist 手动勾选，与测试实际状态不同步 |
| TDD 落地难 | `08-test-cases/` 废弃后，测试与需求映射关系丢失 |

---

## 2. 目标

- 一个 issue 的所有文档集中在一个目录
- 测试状态自动同步，无需人工勾选
- 目录结构清晰，工具可解析

---

## 3. 新目录结构

### 3.1 文档层

```
docs/
└── issues/                              # 统一入口
    ├── f-15-global-tab-bar/             # {轨道}-{全局编号}-{slug}
    │   ├── issue.md                     # 项目管理卡片
    │   ├── plan.md                      # 执行计划（当前生效版）
    │   ├── plans/                       # 历史版本归档
    │   │   └── v1.md
    │   ├── checklist.json               # 验收状态（机器写）
    │   └── specs/
    │       ├── feature-spec.md          # 功能规格
    │       ├── behavior-spec.md         # 行为规格
    │       └── api-spec.md              # API 规格（如有）
    ├── f-16-unified-tab-types/
    │   └── ...
    └── b-18-knowledge-base-crud-api/
        └── ...
```

**命名规则**：
- 格式：`{prefix}-{NN}-{kebab-slug}`
- 前缀：`f` 前端 / `b` 后端 / `d` 设计 / `i` 基础设施 / `q` 质量
- 编号：全局递增，不分轨道，从 01 开始
- slug：简短描述，kebab-case

### 3.2 测试层

按 issue 组织的单元测试：

```
tests/
├── issues/                              # 按 issue 组织的单元测试
│   ├── f-15-global-tab-bar/
│   │   ├── TabBar.spec.ts
│   │   └── AppSidebar.spec.ts
│   ├── f-16-unified-tab-types/
│   │   └── useTabStore.spec.ts
│   └── b-18-knowledge-base-crud-api/
│       └── knowledgeBaseCrud.spec.ts
├── integration/                         # 集成测试（不变）
└── e2e/                                 # E2E 测试（不变）
```

**注意**：需更新 `vitest.config.ts` 以包含 `tests/issues/**/*.{spec.ts,test.ts}`。

### 3.3 废弃目录

迁移完成后删除或归档：
- `docs/02-issues/` -> 迁移到 `docs/issues/`
- `docs/03-specs/` -> 迁移到 `docs/issues/*/specs/`
- `docs/04-plans/` -> 迁移到 `docs/issues/*/plan.md` 和 `plans/v{N}.md`
- `docs/08-test-cases/` -> 已废弃，保持 `99-archived/`

---

## 4. 文件规范

### 4.1 issue.md

项目管理卡片。人写，机器读 frontmatter。

```markdown
---
id: f-15
status: closed
track: frontend
priority: p1
summary: TabBar 提升至全局导航，标签驱动 RouterView 切换
blocked_by: [f-14]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 补充说明

TabBar 迁移涉及全局路由逻辑变更，需确保 f-14 Store 已合并后再启动。
```

**字段说明**：

| 字段 | 来源 | 说明 |
|------|------|------|
| `id` | 人工 | 目录名前缀，如 `f-15` |
| `status` | 机器 | `open` / `in-progress` / `closed`，由 checklist 推导 |
| `track` | 人工 | `frontend` / `backend` / `design` / `infra` / `quality` |
| `priority` | 人工 | `p0` / `p1` / `p2` |
| `blocked_by` | 人工 | 阻塞本 issue 的 ID 列表 |
| `checklist` | 人工 | 指向 checklist.json 的相对路径 |
| `plan` | 人工 | 指向 plan.md 的相对路径 |
| `specs` | 人工 | 指向 specs 目录的相对路径 |

### 4.2 plan.md

执行计划。Agent 生成，人审阅。

当前生效版本为 `plan.md`。历史版本归档在 `plans/v{N}.md`。

```markdown
---
id: f-15
issue: issue.md
version: 1
---

## 任务 1: 迁移 TabBar 组件

**文件**：
- 修改：`packages/webui/src/layouts/AuthenticatedLayout.vue`
- 修改：`packages/webui/src/views/ChatView.vue`
- 测试：`tests/issues/f-15-global-tab-bar/TabBar.spec.ts`

**规格引用**：
- behavior-spec.md 第 3.1 节

- [ ] **步骤 1: 编写失败测试**

```typescript
it('AC-01: renders TabBar in AuthenticatedLayout header', () => {
  const wrapper = mount(AuthenticatedLayout)
  expect(wrapper.find('[data-testid="tab-bar"]').exists()).toBe(true)
})
```

- [ ] **步骤 2: 运行测试确认失败**
- [ ] **步骤 3: 编写最小实现**
- [ ] **步骤 4: 运行测试确认通过**
```

### 4.3 checklist.json

验收状态。机器写，人可读。

```json
{
  "issue_id": "f-15",
  "version": 1,
  "updated_at": "2026-05-20T14:30:00Z",
  "items": [
    {
      "id": "AC-01",
      "desc": "TabBar 迁入 AuthenticatedLayout header",
      "status": "pass",
      "test_file": "tests/issues/f-15-global-tab-bar/TabBar.spec.ts",
      "test_case": "AC-01: renders TabBar in AuthenticatedLayout header"
    },
    {
      "id": "AC-02",
      "desc": "侧边栏点击触发标签操作（非直接路由跳转）",
      "status": "pass",
      "test_file": "tests/issues/f-15-global-tab-bar/AppSidebar.spec.ts",
      "test_case": "AC-02: sidebar click opens tab instead of router push"
    },
    {
      "id": "AC-03",
      "desc": "chat 类型标签可多开，其他类型单例",
      "status": "pass",
      "test_file": "tests/issues/f-15-global-tab-bar/useTabStore.spec.ts",
      "test_case": "AC-03: chat tabs allow duplicates, others are singleton"
    },
    {
      "id": "AC-04",
      "desc": "home 标签常驻且不可关闭",
      "status": "pass",
      "test_file": "tests/issues/f-15-global-tab-bar/TabBar.spec.ts",
      "test_case": "AC-04: rejects closing home tab"
    },
    {
      "id": "AC-05",
      "desc": "关闭逻辑：最后一个非 chat 标签在有 chat 时不可关闭",
      "status": "pass",
      "test_file": "tests/issues/f-15-global-tab-bar/TabBar.spec.ts",
      "test_case": "AC-05: rejects closing last non-chat when chats exist"
    },
    {
      "id": "AC-06",
      "desc": "全部标签关闭后自动创建 home 标签",
      "status": "pass",
      "test_file": "tests/issues/f-15-global-tab-bar/useTabStore.spec.ts",
      "test_case": "AC-06: creates home tab when all tabs closed"
    },
    {
      "id": "AC-07",
      "desc": "审查记录归档到 docs/07-reviews/",
      "status": "pending",
      "manual": true
    }
  ]
}
```

**状态推导规则**：

| checklist 状态 | issue status |
|----------------|--------------|
| 全部 `pass` | `closed` |
| 有 `fail` | `in-progress` |
| 有 `pending` 且无 `fail` | `open` |

### 4.4 specs/

技术契约。人写，开发时核心参考。

```
specs/
├── feature-spec.md      # 用户故事、边界、涉及页面
├── behavior-spec.md     # 交互状态表、测试映射表
└── api-spec.md          # 路由、DTO、错误码（后端 issue 必有）
```

**behavior-spec.md 底部必须包含测试映射表**：

```markdown
## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| loading 状态 | `tests/issues/f-15-global-tab-bar/TabBar.spec.ts` | `AC-01: renders TabBar in AuthenticatedLayout header` |
| 401 错误 | `tests/issues/f-15-global-tab-bar/TabBar.spec.ts` | `AC-02: displays error on unauthorized` |
```

### 4.5 测试文件

```typescript
// tests/issues/f-15-global-tab-bar/TabBar.spec.ts

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TabBar from '@/components/layout/TabBar.vue'

describe('TabBar', () => {
  it('AC-01: renders TabBar in AuthenticatedLayout header', () => {
    // ...
  })

  it('AC-04: rejects closing home tab', () => {
    // ...
  })

  it('AC-05: rejects closing last non-chat when chats exist', () => {
    // ...
  })
})
```

**规则**：
- 测试用例名必须以 `AC-XX:` 开头，与 checklist.json 的 `id` 对应
- 一个测试文件可包含多个 AC，一个 AC 只能有一个测试用例
- 测试文件放在 `tests/issues/{完整目录名}/` 下

---

## 5. 自动化机制

### 5.1 vitest reporter

reporter 只生成报告，不写 `checklist.json`，避免竞态和数据损坏。

```typescript
// tests/reporters/checklist-reporter.ts
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export function checklistReporter() {
  return {
    onFinished(files: any[]) {
      const results = new Map<string, Map<string, 'pass' | 'fail'>>()

      for (const file of files) {
        // 从文件路径提取 issue 完整目录名
        const issueDir = extractIssueDir(file.filepath)
        if (!issueDir) continue

        if (!results.has(issueDir)) results.set(issueDir, new Map())

        for (const task of file.tasks) {
          const acId = extractAcId(task.name)
          if (!acId) continue

          const status = task.result?.state === 'pass' ? 'pass' : 'fail'
          results.get(issueDir)!.set(acId, status)
        }
      }

      // 写入临时报告文件（按 spec 文件名区分，避免同一 issue 多 spec 覆盖）
      const reportDir = resolve('tests/reports')
      if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true })

      for (const [issueDir, acResults] of results) {
        // 从文件路径提取 spec 文件名，如 TabBar.spec.ts -> TabBar
        const specName = file.filepath.split('/').pop()?.replace(/\.(spec|test)\.(ts|js)$/, '') || 'unknown'
        const reportPath = resolve(reportDir, `${issueDir.replace(/\//g, '-')}-${specName}.json`)
        const report = {
          issue_dir: issueDir,
          spec_name: specName,
          updated_at: new Date().toISOString(),
          results: Object.fromEntries(acResults)
        }
        writeFileSync(reportPath, JSON.stringify(report, null, 2))
      }
    }
  }
}

function extractIssueDir(filepath: string): string | null {
  // 从 tests/issues/f-15-global-tab-bar/TabBar.spec.ts
  // 提取 f-15-global-tab-bar
  const match = filepath.match(/tests\/issues\/([^/]+)/)
  return match ? match[1] : null
}

function extractAcId(name: string): string | null {
  const match = name.match(/\b(AC-\d{2,})\b/)
  return match ? match[1] : null
}
```

### 5.2 issue 状态推导脚本

读取 reporter 生成的报告 + checklist.json，合并后保守更新 issue.md 的 `status` 字段。

```bash
# 根据 checklist.json + 测试报告 批量更新 issue.md 的 status
node scripts/sync-issue-status.js
```

```javascript
// scripts/sync-issue-status.js
const { readdirSync, readFileSync, writeFileSync, existsSync } = require('fs')
const { resolve } = require('path')

function updateIssueStatus(issueDirName) {
  const issueDir = `docs/issues/${issueDirName}`
  const issuePath = `${issueDir}/issue.md`
  const checklistPath = `${issueDir}/checklist.json`
  // 读取所有该 issue 的 spec 报告文件
  const reportFiles = readdirSync('tests/reports')
    .filter(f => f.startsWith(`${issueDirName.replace(/\//g, '-')}-`))

  // 读取 checklist
  const checklist = JSON.parse(readFileSync(checklistPath, 'utf-8'))

  // 合并所有 spec 报告（如有）
  const reportDir = 'tests/reports'
  if (existsSync(reportDir)) {
    const reportFiles = readdirSync(reportDir)
      .filter(f => f.startsWith(`${issueDirName.replace(/\//g, '-')}-`))
    
    for (const reportFile of reportFiles) {
      const report = JSON.parse(readFileSync(`${reportDir}/${reportFile}`, 'utf-8'))
      for (const item of checklist.items) {
        if (!item.manual && report.results[item.id]) {
          item.status = report.results[item.id]
        }
      }
    }
    writeFileSync(checklistPath, JSON.stringify(checklist, null, 2))
  }

  // 推导 status
  const statuses = checklist.items.map(i => i.status)
  let newStatus = 'open'
  if (statuses.every(s => s === 'pass')) newStatus = 'closed'
  else if (statuses.some(s => s === 'fail')) newStatus = 'in-progress'

  // 保守更新：只替换 status 值，保留行尾注释
  const content = readFileSync(issuePath, 'utf-8')
  const statusRegex = /^(status:)\s*\S+(.*)$/m
  if (statusRegex.test(content)) {
    const newContent = content.replace(statusRegex, `$1 ${newStatus}$2`)
    writeFileSync(issuePath, newContent)
    console.log(`Updated ${issueDirName}: ${newStatus}`)
  }
}

// 批量处理所有 issue
const issueDirs = readdirSync('docs/issues', { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

for (const issueDirName of issueDirs) {
  try {
    updateIssueStatus(issueDirName)
  } catch (err) {
    console.error(`Failed to update ${issueDirName}:`, err.message)
  }
}
```

---

## 6. Skill 改造清单

| Skill | 改造内容 | 优先级 |
|-------|----------|--------|
| `issue-generator` | 输出 `docs/issues/{prefix}-{NN}-{slug}/` 目录，包含 `issue.md` + `checklist.json` 骨架 | P0 |
| `spec-validator` | 读取 `docs/issues/{prefix}-{NN}-{slug}/specs/`，验证 behavior-spec 底部测试映射表 | P0 |
| `plan-generator` | 输出 `docs/issues/{prefix}-{NN}-{slug}/plan.md`，历史版本归档到 `plans/v{N}.md` | P0 |
| `dev-orchestrator` | 在 `tests/issues/{prefix}-{NN}-{slug}/` 下创建 `.spec.ts`，先 red 后 green | P0 |
| `kb-review` | 检查 checklist.json 状态，确认全部 pass 才允许关闭 | P0 |
| `issue-lifecycle` | 调用 `sync-issue-status.js` 更新 issue.md frontmatter | P0 |
| `issue-updater` | 更新 `BACKLOG.md` + `CHANGELOG.md` | P0 |
| `project-workflow` | 更新所有路径引用，指向 `docs/issues/` | P1 |
| `writing-issues.md` | 更新 issue 文件规范 | P1 |
| `writing-specs.md` | 更新 spec 目录结构规范 | P1 |
| `writing-plans.md` | 更新 plan 版本归档规范 | P1 |
| `workflow.md` | 重写整个流程文档 | P1 |
| `BACKLOG.md` + `CHANGELOG.md` | 替换 PROGRESS.md，拆分待办/完成 | P2 |

---

## 7. 迁移步骤

### 7.1 准备阶段

1. 备份当前 `docs/02-issues/` `03-specs/` `04-plans/`
2. 创建 `docs/issues/` 目录
3. 创建 `tests/issues/` 目录
4. 编写 `checklist-reporter.ts`
5. 编写 `sync-issue-status.js`
6. 更新 `vitest.config.ts` 配置以包含 `tests/issues/`

### 7.2 批量迁移

```bash
# 示例：迁移 f-15（保持现有编号）
mkdir -p docs/issues/f-15-global-tab-bar/specs
mkdir -p docs/issues/f-15-global-tab-bar/plans
mkdir -p tests/issues/f-15-global-tab-bar

# issue.md（精简内容，调整 frontmatter）
cp docs/02-issues/f-15-global-tab-bar.md docs/issues/f-15-global-tab-bar/issue.md

# specs
cp docs/03-specs/f-15-global-tab-bar/*.md docs/issues/f-15-global-tab-bar/specs/

# plan（当前生效版 + 历史归档）
cp docs/04-plans/f-15-global-tab-bar/v1.md docs/issues/f-15-global-tab-bar/plan.md
# 如有历史版本：
# cp docs/04-plans/f-15-global-tab-bar/v1.md docs/issues/f-15-global-tab-bar/plans/v1.md

# checklist.json（新建，从 spec 的验收标准提取 items）
cat > docs/issues/f-15-global-tab-bar/checklist.json << 'EOF'
{
  "issue_id": "f-15",
  "items": [
    {"id": "AC-01", "desc": "TabBar 迁入 AuthenticatedLayout header", "status": "pending"},
    {"id": "AC-02", "desc": "侧边栏点击触发标签操作", "status": "pending"},
    {"id": "AC-03", "desc": "chat 多开 / 其他单例", "status": "pending"},
    {"id": "AC-04", "desc": "home 标签常驻不可关", "status": "pending"},
    {"id": "AC-05", "desc": "关闭逻辑覆盖所有场景", "status": "pending"},
    {"id": "AC-06", "desc": ".spec.ts 覆盖所有关闭场景", "status": "pending"},
    {"id": "AC-07", "desc": "审查记录归档", "status": "pending", "manual": true}
  ]
}
EOF

# 测试文件移动并添加 AC-XX 前缀
# mv packages/webui/src/components/layout/TabBar.spec.ts tests/issues/f-15-global-tab-bar/
# 修改测试用例名添加 AC-XX 前缀
```

### 7.3 验证阶段

1. 跑 `sync-issue-status.js`，确认 issue status 正确
2. 跑 vitest，确认 checklist-reporter 正常生成报告
3. 逐个 skill 测试新流程

### 7.4 清理阶段

1. 删除旧目录 `02-issues/` `03-specs/` `04-plans/`
2. 更新 `docs/00-meta/workflow.md`
3. 更新所有 skill 文档
4. 替换 `PROGRESS.md` 为 `BACKLOG.md` + `CHANGELOG.md`
5. 提交 commit

---

## 8. 验收标准

- [ ] `docs/issues/` 目录存在且结构正确
- [ ] 所有历史 issue 已迁移并重新编号为全局编号
- [ ] `tests/issues/` 目录存在，测试文件按 issue 目录组织
- [ ] vitest 跑完后 reporter 生成报告文件
- [ ] `sync-issue-status.js` 能正确合并报告并推导 issue status
- [ ] 所有 skill 文档已更新
- [ ] `BACKLOG.md` + `CHANGELOG.md` 已替换 `PROGRESS.md`
- [ ] 旧目录已清理

---

## 9. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 迁移遗漏文件 | 迁移脚本生成报告，人工核对 |
| skill 改造引入 bug | 先改一个 skill 测试通过后再改下一个 |
| reporter 生成报告不完整 | reporter 只读不写 checklist.json，由 sync 脚本统一合并 |
| sync 脚本覆盖人工 frontmatter 格式 | 只替换 `status:` 行，保留其他内容和注释 |
| 团队成员不适应新结构 | 已直接迁移归档，通过 CHANGELOG.md 可查阅历史 |
| 无测试 AC 无法标记完成 | `manual: true` 字段，reporter 跳过，人工标记 |
| issue 编号全局化冲突 | 迁移时统一重新编号，旧编号在 commit message 中记录 |

回滚：恢复备份目录，revert commit。

---

## 10. 进度追踪文件改造

### 10.1 文件拆分

原 `PROGRESS.md` 拆分为两个文件：

| 文件 | 用途 | 更新时机 |
|------|------|----------|
| `BACKLOG.md` | 未处理 / 进行中的 issue 列表 | issue 状态变更时 |
| `CHANGELOG.md` | 已完成的 issue 记录（按时间倒序） | issue 关闭时 |

### 10.2 BACKLOG.md 格式

```markdown
# 待办事项

> 自动生成于 2026-05-20
> 运行 `node scripts/sync-backlog.js` 更新

## 进行中

| id | track | priority | summary | blocked_by |
|----|-------|----------|---------|------------|
| f-16 | frontend | p1 | 统一 Tab 类型定义 | f-15 |
| b-18 | backend | p1 | 知识库 CRUD API | — |

## 待启动

| id | track | priority | summary | blocked_by |
|----|-------|----------|---------|------------|
| f-17 | frontend | p2 | 路由单例标签 | f-16 |
| i-19 | infra | p2 | Milvus 服务封装 | — |
```

### 10.3 CHANGELOG.md 格式

```markdown
# 完成日志

## [2026-05-20]

- [closed] TabBar 全局化重构 [issue](docs/99-archived/issues/f-15-global-tab-bar/)
- [closed] NestJS 安全基线 [issue](docs/99-archived/issues/i-10-nestjs-security/)
- [closed] 设置页账户 Tab [issue](docs/99-archived/issues/f-19-settings-account-tabs/)
- [closed] 统一 Tab 类型定义 [issue](docs/99-archived/issues/f-16-unified-tab-types/)
- [closed] 路由单例标签 [issue](docs/99-archived/issues/f-17-route-singleton-tabs/)
- [closed] 清理 ChatPage 遗留组件 [issue](docs/99-archived/issues/f-18-cleanup-chatpage/)
- [closed] 密码传输加密 [issue](docs/99-archived/issues/q-04-password-transport-encryption/)
- [closed] 安全基线 [issue](docs/99-archived/issues/q-01-security-baseline/)
- [closed] V1 清理 [issue](docs/99-archived/issues/q-03-v1-cleanup/)
- [closed] 数据迁移工具 [issue](docs/99-archived/issues/i-06-data-migration/)
- [closed] API 客户端升级 [issue](docs/99-archived/issues/i-07-api-client/)
- [closed] 设置 API [issue](docs/99-archived/issues/b-05-settings-api/)
- [closed] 会话 API [issue](docs/99-archived/issues/b-03-session-api/)
- [closed] SSE 流式对话 API [issue](docs/99-archived/issues/b-04-chat-sse-api/)

## [2026-05-19]

- [closed] 侧边栏导航 [issue](docs/99-archived/issues/f-03-sidebar-navigation/)
- [closed] 知识库列表页 [issue](docs/99-archived/issues/f-05-knowledge-base-list/)
- [closed] 文件管理器 [issue](docs/99-archived/issues/f-06-knowledge-base-file-manager/)
- [closed] 文件上传组件 [issue](docs/99-archived/issues/f-07-file-upload-component/)
- [closed] 文件夹管理 [issue](docs/99-archived/issues/f-08-folder-management/)
- [closed] 问答对话页 [issue](docs/99-archived/issues/f-09-chat-page/)
- [closed] 消息渲染器 [issue](docs/99-archived/issues/f-10-message-renderer/)
- [closed] 知识库选择器 [issue](docs/99-archived/issues/f-11-kb-selector/)
- [closed] 对话历史 [issue](docs/99-archived/issues/f-12-chat-history/)
- [closed] 设置页 [issue](docs/99-archived/issues/f-13-settings-page/)
- [closed] 适配器移除 [issue](docs/99-archived/issues/f-14-adapter-removal/)
- [closed] 知识库 CRUD API [issue](docs/99-archived/issues/b-02-knowledge-base-crud-api/)

## [2026-05-16]

- [closed] 核心接口定义 [issue](docs/99-archived/issues/i-00-core-interfaces/)
- [closed] Docker Compose 基础设施 [issue](docs/99-archived/issues/i-01-docker-compose-infra/)
- [closed] Prisma 数据模型 [issue](docs/99-archived/issues/i-02-prisma-setup/)
- [closed] NestJS 服务器 [issue](docs/99-archived/issues/i-08-nestjs-server-setup/)
- [closed] NestJS 认证系统 [issue](docs/99-archived/issues/i-09-nestjs-auth-system/)
- [closed] NestJS 安全基线 [issue](docs/99-archived/issues/i-10-nestjs-security/)
- [closed] MinIO 服务 [issue](docs/99-archived/issues/i-11-minio-service/)
- [closed] Milvus 服务 [issue](docs/99-archived/issues/i-12-milvus-service/)
- [closed] BullMQ 服务 [issue](docs/99-archived/issues/i-13-bullmq-service/)
- [closed] JWT API 客户端 [issue](docs/99-archived/issues/i-14-jwt-api-client/)
- [closed] RAG SDK 合约 [issue](docs/99-archived/issues/d-01-rag-sdk-contracts/)
```

**规则**：
- 按日期倒序排列，最新在上
- 条目使用归档路径 `docs/99-archived/issues/{dir}/`
- 日期为运行更新当日的纯日期（如 `2026-05-20`），不涉及时分或 issue 实际关闭时间
- 不显示 Phase 标题，纯时间线

### 10.4 自动生成脚本

```javascript
// scripts/sync-backlog.js
const { readdirSync, readFileSync, writeFileSync } = require('fs')
const yaml = require('yaml')

function parseIssue(issuePath) {
  const content = readFileSync(issuePath, 'utf-8')
  const frontmatter = content.match(/---\n([\s\S]*?)\n---/)[1]
  return yaml.parse(frontmatter)
}

const issues = readdirSync('docs/issues', { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => parseIssue(`docs/issues/${d.name}/issue.md`))

const open = issues.filter(i => i.status === 'open')
const inProgress = issues.filter(i => i.status === 'in-progress')
const closed = issues.filter(i => i.status === 'closed')

// 生成 BACKLOG.md
const backlog = `# 待办事项

> 自动生成于 ${new Date().toISOString().split('T')[0]}

## 进行中

${formatTable(inProgress)}

## 待启动

${formatTable(open)}
`
writeFileSync('BACKLOG.md', backlog)

// 生成 CHANGELOG.md（追加新关闭的 issue 到当天）
const today = new Date().toISOString().split('T')[0]
// ... 读取现有 CHANGELOG.md，追加当天条目
```

### 10.5 旧 PROGRESS.md 处理

1. 提取所有 issue 完成记录
2. 按时间归类到 CHANGELOG.md
3. 未完成的归类到 BACKLOG.md
4. 删除旧 PROGRESS.md
5. 提交 commit: `docs: 拆分 PROGRESS.md 为 BACKLOG.md + CHANGELOG.md`
