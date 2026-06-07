---
issue: f-40
type: behavior-spec
status: draft
---

# f-40 Session Store 行为规格

## 状态转换图

```
Session 列表生命周期：

  [初始] ──loadSessions()──▶ [loading] ──成功──▶ [loaded: sessions[]]
                    │                      │
                    └──失败──▶ [error]      └──createSession()──▶ [loading] ──成功──▶ [新增 + 激活]
                                                         │
  [loaded] ──deleteSession(id)──▶ [loading]               └──失败──▶ [error]
                    │
                    ├──成功──▶ [sessions 移除该项]
                    │           ├── activeSession 是被删项 → activeSession = null
                    │           └── activeSession 不是被删项 → 不变
                    └──失败──▶ [error]

  [loaded] ──renameSession(id, title)──▶ [loading]
                    │
                    ├──成功──▶ [title 更新]
                    └──失败──▶ [error]
```

## 交互状态表

| 状态/操作 | 初始态 | loading | 成功 | 失败 |
|-----------|--------|---------|------|------|
| **loadSessions** | `sessions=[]`, `isLoadingSessions=false` | `isLoadingSessions=true`, `error=null` | `sessions=[...]`, `isLoadingSessions=false` | `error="..."`
| **createSession** | `isLoadingSessions=false` | `isLoadingSessions=true`, `error=null` | `sessions` 头部新增, `activeSession=新session`, `isLoadingSessions=false` | `error="..."`
| **renameSession** | — | `isLoadingSessions=true`, `error=null` | `sessions[idx].title` 更新, `isLoadingSessions=false` | `error="..."`
| **deleteSession** | — | `isLoadingSessions=true`, `error=null` | `sessions` 移除, active清理, `isLoadingSessions=false` | `error="..."`
| **setSessions** | 同步 | — | `sessions` 直接替换 | — |
| **addSession** | 同步 | — | 头部插入 | — |
| **removeSession** | 同步 | — | filter 移除 | — |
| **updateSession** | 同步 | — | findIndex + 更新 | — |
| **clearError** | — | — | `error=null` | — |

## 边界条件

### 加载

- **重复 loadSessions**：多次调用时，每次独立请求，后者覆盖前者结果
- **空列表**：API 返回空 sessions → `sessions = []`，不报错
- **网络异常**：捕获异常 → `error = "加载会话列表失败"`

### 创建

- **创建失败不污染列表**：API 失败时 sessions 不变，error 记录错误信息
- **创建成功自动激活**：`activeSession = 新 session`

### 删除

- **删除活跃会话**：`activeSessionId === id` → `activeSession = null`
- **删除不存在的会话**：API 调用仍发出，由后端返回 404；前端 catch 后设置 error
- **乐观移除**：先 filter 移除本地 → 调 API → 失败时…（注：本 store 不做乐观更新，先调 API 成功后再移除）

### 重命名

- **空标题**：不调用 API，直接 return（在 action 内部校验 `title.trim()`）
- **重命名不存在的会话**：API 404 → error

### Streaming 兼容

- 已有的 `isStreaming` / `streamingContent` / `appendStreamContent` / `flushStreamContent` 必须保持行为不变
- 新增的 `isLoadingSessions` 与已有 `isLoadingHistory` 互不干扰

## 错误恢复

1. `error` 字段挂在 store 顶层，所有异步操作共享
2. 调用 `clearError()` 清除
3. 新的异步操作自动清除上一个 error（`error = null` 在 try 块开始时设置）
