---
name: issue-updater
description: Update BACKLOG.md and CHANGELOG.md based on issue status changes. Use this skill whenever the user mentions updating backlog, updating changelog, syncing progress, issue status changed, or after closing an issue. Also use when the user asks about project status, what's in progress, what's done, or wants to refresh the progress tracking files.
---

# Issue Updater

Update project progress tracking files (BACKLOG.md + CHANGELOG.md) by scanning issue frontmatter.

## When to Use

- After `sync-issue-status.js` runs
- After closing an issue
- When user asks "update backlog", "update changelog", "sync progress"
- When user asks "what's in progress", "what's done", "show project status"
- When issue status changes (open -> in-progress -> closed)

## Input

Optional flags (parsed from user prompt):
- `--date YYYY-MM-DD` — Backfill historical closed entries to specific date
- `--issue {id}` — Update single issue only (e.g., `--issue f-015`)
- Default — Scan all issues and update both files

## Output

- Updated `BACKLOG.md` in project root
- Updated `CHANGELOG.md` in project root
- Console log of changes made

## Workflow

### Step 1: Scan Issues

Read all `docs/issues/*/issue.md` files. Parse frontmatter for each:

```yaml
---
id: f-015
status: closed
track: frontend
priority: p1
summary: TabBar 提升至全局导航
blocked_by: [f-014]
---
```

Required fields: `id`, `status`, `track`, `priority`, `summary`
Optional fields: `blocked_by`

### Step 2: Categorize

| status | Destination |
|--------|-------------|
| `open` | BACKLOG.md "待启动" |
| `in-progress` | BACKLOG.md "进行中" |
| `closed` | CHANGELOG.md (grouped by date) |

### Step 3: Generate BACKLOG.md

```markdown
# 待办事项

> 自动生成于 2026-05-20

## 进行中

| id | track | priority | summary | blocked_by |
|----|-------|----------|---------|------------|
| f-016 | frontend | p1 | 统一 Tab 类型定义 | f-015 |
| b-018 | backend | p1 | 知识库 CRUD API | — |

## 待启动

| id | track | priority | summary | blocked_by |
|----|-------|----------|---------|------------|
| f-017 | frontend | p2 | 路由单例标签 | f-016 |
```

**Sort order:**
1. Priority: p0 > p1 > p2
2. Then by id ascending

### Step 4: Generate CHANGELOG.md

Read existing CHANGELOG.md if present. Preserve all history.

For newly closed issues (not already in CHANGELOG):

```markdown
# 完成日志

## [2026-05-20]

- [closed] TabBar 全局化重构 [issue](docs/99-archived/issues/f-15-global-tab-bar/)
- [closed] NestJS 安全基线 [issue](docs/99-archived/issues/i-10-nestjs-security/)

## [2026-05-19]

- [closed] 侧边栏导航 [issue](docs/99-archived/issues/f-03-sidebar-navigation/)
```

**Rules:**
- Group by date (newest first)
- Date is the pure date when the update runs (e.g. `2026-05-20`), no time component
- If `--date` specified, append to that date section
- If date section doesn't exist, create it
- If issue already exists in CHANGELOG, skip (idempotent)
- Each entry format: `- [closed] {summary} [issue]({archive_path}/)`
- Archive path: `docs/99-archived/issues/{dir}/`

### Step 5: Write Files

Write both files to project root. Output summary:

```
Updated BACKLOG.md:
  - 进行中: 2 issues
  - 待启动: 3 issues

Updated CHANGELOG.md:
  - 新增: 2 entries (2026-05-20)
  - 历史总计: 45 entries
```

## Edge Cases

| Case | Handling |
|------|----------|
| No issues found | Create empty BACKLOG.md with "暂无待办事项" |
| No closed issues | Create empty CHANGELOG.md with "暂无完成记录" |
| Issue missing frontmatter | Log warning, skip that issue |
| Issue missing `summary` | Use id as fallback |
| CHANGELOG.md doesn't exist | Create new file |
| BACKLOG.md doesn't exist | Create new file |
| `--issue` not found | Log error, skip |

## Example Commands

```bash
# Update all issues
node scripts/update-progress.js

# Backfill historical entry
node scripts/update-progress.js --date 2026-05-15

# Update single issue
node scripts/update-progress.js --issue f-015
```

## Implementation Reference

```javascript
// scripts/update-progress.js
const { readdirSync, readFileSync, writeFileSync, existsSync } = require('fs')
const yaml = require('yaml')

function parseIssue(issuePath) {
  const content = readFileSync(issuePath, 'utf-8')
  const match = content.match(/---\n([\s\S]*?)\n---/)
  if (!match) return null
  return yaml.parse(match[1])
}

function scanIssues() {
  const dirs = readdirSync('docs/issues', { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  return dirs.map(dir => {
    const issue = parseIssue(`docs/issues/${dir}/issue.md`)
    if (!issue) return null
    return { ...issue, dir }
  }).filter(Boolean)
}

function generateBacklog(issues) {
  const open = issues.filter(i => i.status === 'open')
  const inProgress = issues.filter(i => i.status === 'in-progress')

  // Sort by priority then id
  const sortFn = (a, b) => {
    const pMap = { p0: 0, p1: 1, p2: 2 }
    if (pMap[a.priority] !== pMap[b.priority]) {
      return pMap[a.priority] - pMap[b.priority]
    }
    return a.id.localeCompare(b.id)
  }

  const formatTable = (items) => {
    if (items.length === 0) return '_暂无_'
    const rows = items.map(i =>
      `| ${i.id} | ${i.track} | ${i.priority} | ${i.summary} | ${i.blocked_by?.join(', ') || '—'} |`
    )
    return ['| id | track | priority | summary | blocked_by |', '|----|-------|----------|---------|------------|', ...rows].join('\n')
  }

  return `# 待办事项\n\n> 自动生成于 ${new Date().toISOString().split('T')[0]}\n\n## 进行中\n\n${formatTable(inProgress.sort(sortFn))}\n\n## 待启动\n\n${formatTable(open.sort(sortFn))}\n`
}

function generateChangelog(issues, existingContent = '', targetDate = null) {
  const date = targetDate || new Date().toISOString().split('T')[0]
  const closed = issues.filter(i => i.status === 'closed')

  // Parse existing entries to avoid duplicates
  const existingIds = new Set()
  const idRegex = /\[issue\]\(docs\/99-archived\/issues\/([^/]+)\//g
  let match
  while ((match = idRegex.exec(existingContent)) !== null) {
    existingIds.add(match[1])
  }

  // Filter new closed issues
  const newEntries = closed
    .filter(i => !existingIds.has(i.dir))
    .map(i => `- [closed] ${i.summary} [issue](docs/99-archived/issues/${i.dir}/)`)

  if (newEntries.length === 0 && existingContent) {
    return existingContent // No changes
  }

  // Build new content
  let content = existingContent || '# 完成日志\n\n'

  // Check if date section exists
  const dateHeader = `## [${date}]`
  if (content.includes(dateHeader)) {
    // Append to existing date section
    const insertPos = content.indexOf(dateHeader) + dateHeader.length
    content = content.slice(0, insertPos) + '\n\n' + newEntries.join('\n') + content.slice(insertPos)
  } else {
    // Create new date section at top
    content = content.replace('# 完成日志\n\n', `# 完成日志\n\n${dateHeader}\n\n${newEntries.join('\n')}\n\n`)
  }

  return content
}

// Main
const issues = scanIssues()
const backlog = generateBacklog(issues)
writeFileSync('BACKLOG.md', backlog)

const existingChangelog = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf-8') : ''
const changelog = generateChangelog(issues, existingChangelog)
writeFileSync('CHANGELOG.md', changelog)

console.log(`Updated BACKLOG.md: ${issues.filter(i => i.status !== 'closed').length} issues`)
console.log(`Updated CHANGELOG.md: ${issues.filter(i => i.status === 'closed').length} closed`)
```
