---
issue: f-42
type: behavior-spec
status: draft
---

# f-42 File Store 行为规格

## 上传任务状态机

```
  ┌──────────────────────────────────────────────┐
  │                                              │
  ▼                                              │
[queued] ──processQueue()──▶ [uploading] ──成功──▶ [completed]
                                │                    │
                                │                    │
                                └──失败──▶ [failed]   │
                                     │        │       │
                                     │        ▼       ▼
                                     │   removeTask() / clearCompleted()
                                     │        │
                                     └────────┘
```

## 交互状态表

### 上传队列操作

| 状态/操作 | 初始态 | 执行后 | 副作用 |
|-----------|--------|--------|--------|
| **addTask** | `uploadTasks=[]` | `uploadTasks=[{status:'queued',...}]` | 返回 taskId |
| **processQueue** | 有 queued + 空闲槽位 | queued→uploading，activeCount++ | 触发调用方上传 |
| **updateProgress** | task status='uploading' | task.progress 更新 | 仅当 status=uploading 时有效 |
| **markComplete** | task status='uploading' | status='completed', progress=100 | processQueue() 自动调用 |
| **markFailed** | task status='uploading' | status='failed', error 设置 | processQueue() 自动调用 |
| **removeTask** | task 存在于列表 | filter 移除 | 无 |
| **clearCompleted** | 有 completed/failed 项 | 移除所有已完成/失败 | 不影响 uploading/queued |

### 并发控制

```
初始: uploadTasks = [], maxConcurrent = 3

添加 5 个任务:
  addTask(A) → uploadTasks = [A:queued], processQueue() → [A:uploading], activeCount=1
  addTask(B) → uploadTasks = [A:uploading, B:uploading], activeCount=2
  addTask(C) → uploadTasks = [A:uploading, B:uploading, C:uploading], activeCount=3
  addTask(D) → uploadTasks = [..., D:queued], activeCount=3 (槽位满，不自动启动)
  addTask(E) → uploadTasks = [..., D:queued, E:queued]

A 上传完成:
  markComplete(A) → [A:completed, B:uploading, C:uploading, D:queued, E:queued]
  processQueue() 自动触发 → [A:completed, B:uploading, C:uploading, D:uploading, E:queued]
```

### 文件浏览操作

| 状态/操作 | 初始态 | loading | 成功 | 失败 |
|-----------|--------|---------|------|------|
| **loadItems** | `isLoading=false` | `isLoading=true`, `error=null` | folders+documents 更新, `isLoading=false` | `error="..."`
| **deleteDocument** | — | `isLoading=true` | `documents` filter 移除, `isLoading=false` | `error="..."`
| **renameDocument** | — | `isLoading=true` | `documents[idx]` 替换, `isLoading=false` | `error="..."`
| **moveDocument** | — | `isLoading=true` | `documents` filter 移除, `isLoading=false` | `error="..."`
| **createFolder** | — | — | 返回 Folder 对象 | 抛出异常 |
| **deleteFolder** | — | — | 无返回值 | 抛出异常 |

## 面包屑计算

```
breadcrumb():
  path = []
  fid = currentFolderId
  while fid:
    f = folders.find(x => x.id === fid)
    if !f → break
    path.unshift(f)
    fid = f.parentId
  return path
```

## 边界条件

### 上传队列
- **重复 taskId**：不检查，调用方负责生成唯一 ID（`crypto.randomUUID()`）
- **更新不存在的任务**：`updateProgress` / `markComplete` / `markFailed` 对不存在的 taskId 静默忽略
- **空队列 processQueue**：无操作
- **全部失败**：所有任务 status=failed，activeCount=0，无新任务启动
- **并发数为 0**：`maxConcurrent=0` 时所有任务保持 queued
- **同名文件**：允许添加，队列不做去重

### 文件浏览
- **loadItems 空目录**：folders 和 documents 均为 []，不报错
- **currentKbId 为空时 deleteDocument**：静默 return
- **moveDocument 后列表中消失**：因为移动到其他 folder，当前视图不再显示
- **切换 KB**：调用方应先调 `resetFileBrowse()` 清空 folders/documents

## 错误隔离

- 上传任务 A 失败不影响 B/C 的上传
- 文件浏览操作的 error 不影响上传队列
- `clearError()` 清除所有操作错误
