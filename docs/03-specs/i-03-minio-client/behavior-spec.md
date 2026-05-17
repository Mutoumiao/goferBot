---
issue_id: i-03-minio-client
type: behavior-spec
status: approved
summary: 定义客户端创建（环境变量读取+连接）、Bucket 初始化（检查+自动创建）以及 upload/download/delete/getUrl 四条核心操作的正常流程与失败边界行为。
---
# Behavior Spec: i-03-minio-client

## 1. 初始化行为

### 1.1 客户端创建

**触发条件**：应用启动时，导入并实例化 `MinIOStorageProvider`。

**行为**：
1. 从环境变量读取配置：
   - `MINIO_ENDPOINT` — 默认 `http://localhost:9000`
   - `MINIO_ACCESS_KEY` — 无默认值，缺失时抛出 `StorageError`
   - `MINIO_SECRET_KEY` — 无默认值，缺失时抛出 `StorageError`
   - `MINIO_BUCKET` — 默认 `goferbot-files`
   - `MINIO_REGION` — 可选，默认 `us-east-1`
2. 使用 `minio.Client` 构造函数创建客户端实例。
3. 内部保存客户端引用与 bucket 名称。

### 1.2 Bucket 检查与创建

**触发条件**：`MinIOStorageProvider` 实例化后，显式调用 `initialize()`（或由启动脚本调用）。

**行为**：
1. 调用 `minio.Client#bucketExists(bucketName)`。
2. 若返回 `false`：
   - 调用 `minio.Client#makeBucket(bucketName, region)` 创建 bucket。
   - 创建成功后记录日志（`info` 级别）。
3. 若返回 `true`：静默通过，不重复创建。

**成功判定**：方法返回 `Promise<void>`，无异常抛出。

**失败场景**：
- MinIO 服务不可达 → 抛出 `StorageError`，消息包含 endpoint 与错误原因。
- 权限不足（Access Denied）→ 抛出 `StorageError`，提示检查 AccessKey / SecretKey。

## 2. 上传流程

### 2.1 正常上传

**触发条件**：业务层调用 `upload(key, stream, contentType)`。

**行为**：
1. 校验 `key` 非空且符合格式（以 `users/` 开头，包含 `/kb/`）。
2. 将 `stream` 通过 `minio.Client#putObject(bucket, key, stream, size?, meta)` 写入 MinIO。
3. 附加 metadata：
   - `X-Amz-Meta-Original-Name`：从 key 尾部提取 `<doc-id>_<filename>` 中的 filename。
   - `X-Amz-Meta-Content-Type`：`contentType` 参数值。
   - `X-Amz-Meta-Upload-Time`：当前时间 ISO 8601 字符串。
4. 等待 MinIO 返回 `etag` 与写入大小。
5. 返回 `StorageMeta` 对象：
   ```ts
   {
     key,
     size: <实际写入字节数>,
     etag: <MinIO 返回的 ETag>,
     contentType,
     lastModified: new Date()
   }
   ```

**成功判定**：返回的 `StorageMeta.size > 0` 且 `etag` 非空。

### 2.2 覆盖上传

**行为**：若 `key` 已存在，`putObject` 直接覆盖旧对象，行为幂等。返回新的 `etag` 与 `lastModified`。

### 2.3 错误场景

| 场景 | 抛出错误 | 消息示例 |
|------|----------|----------|
| `key` 为空或格式非法 | `ValidationError` | `"storage key 不能为空或格式错误"` |
| `stream` 为空 | `ValidationError` | `"上传流不能为空"` |
| MinIO 连接中断 | `StorageError` | `"上传失败：无法连接到 MinIO (<endpoint>)"` |
| bucket 不存在（初始化后意外删除）| `StorageError` | `"上传失败：bucket 'goferbot-files' 不存在"` |
| 权限不足 | `StorageError` | `"上传失败：访问被拒绝，请检查 MinIO 凭据"` |

## 3. 下载流程

### 3.1 正常下载

**触发条件**：业务层调用 `download(key)`。

**行为**：
1. 调用 `minio.Client#getObject(bucket, key)` 获取 `NodeJS.ReadableStream`。
2. 将 Node 可读流转换为 Web 标准的 `ReadableStream<Uint8Array>`。
3. 返回转换后的流。

**成功判定**：返回的流可读，首次 `read()` 不抛出异常。

### 3.2 错误场景

| 场景 | 抛出错误 | 消息示例 |
|------|----------|----------|
| `key` 不存在 | `NotFoundError` | `"文件不存在：users/xxx/kb/yyy/doc-123_报告.pdf"` |
| MinIO 连接中断 | `StorageError` | `"下载失败：无法连接到 MinIO"` |
| bucket 不存在 | `StorageError` | `"下载失败：bucket 不存在"` |

## 4. 删除流程

### 4.1 正常删除

**触发条件**：业务层调用 `delete(key)`。

**行为**：
1. 调用 `minio.Client#removeObject(bucket, key)`。
2. 方法返回 `Promise<void>`。

### 4.2 幂等删除

**行为**：若 `key` 不存在，MinIO `removeObject` 静默成功（不抛异常）。实现层也可选择先 `statObject` 判断存在性，再决定是否删除；但无论哪种方式，调用方感知一致：不抛异常。

### 4.3 与元数据的级联关系

**说明**：`delete(key)` 仅负责删除 MinIO 对象。关联的 `documents` 表记录删除由上层 Service 层负责（通过 Drizzle ORM 执行），不在本层自动级联。

### 4.4 错误场景

| 场景 | 抛出错误 | 消息示例 |
|------|----------|----------|
| MinIO 连接中断 | `StorageError` | `"删除失败：无法连接到 MinIO"` |
| 权限不足 | `StorageError` | `"删除失败：访问被拒绝"` |

## 5. URL 获取流程

### 5.1 内网直连 URL

**触发条件**：业务层调用 `getUrl(key, options?)`。

**行为**：
1. 先通过 `minio.Client#statObject(bucket, key)` 确认对象存在。
2. 若存在，构造直连 URL：
   ```
   ${MINIO_ENDPOINT}/${MINIO_BUCKET}/${encodeURIComponent(key)}
   ```
3. 返回 URL 字符串。

**错误场景**：
- 对象不存在 → 抛出 `NotFoundError`。
- 连接失败 → 抛出 `StorageError`。

### 5.2 预签名上传 URL（预留）

**触发条件**：业务层调用 `getPresignedUploadUrl(key, expiry)`。

**行为**：
- MVP 阶段可返回占位实现：抛出 `StorageError`，消息提示 `"预签名 URL 尚未实现（Phase 6）"`；或返回与 `getUrl` 相同的直连 URL（不推荐生产使用）。
- Phase 6 完善后，使用 `minio.Client#presignedPutObject(bucket, key, expiry)` 生成真正的预签名 URL。

## 6. 错误处理行为

### 6.1 错误包装原则

- 所有 `minio` 库抛出的原始异常必须在实现层捕获。
- 根据异常类型映射到标准错误类：

| MinIO 异常特征 | 映射错误类 |
|----------------|-----------|
| `NoSuchKey` / `NotFound` | `NotFoundError` |
| `NoSuchBucket` | `StorageError` |
| `AccessDenied` / `InvalidAccessKeyId` | `StorageError` |
| `ConnectionRefused` / `ETIMEDOUT` / `ECONNREFUSED` | `StorageError` |
| 其他未知错误 | `StorageError` |

### 6.2 日志行为

- `info`：bucket 创建成功、上传成功（含 key 与 size）。
- `warn`：对象不存在时的下载/删除尝试（如选择非静默策略）。
- `error`：连接失败、权限错误、未知异常（含原始错误堆栈）。

## 7. 生命周期行为

### 7.1 启动时序

```
应用启动
  └── 读取环境变量配置
  └── 创建 minio.Client 实例
  └── 调用 initialize() → 检查/创建 bucket
  └── 标记 storageProvider 就绪
```

### 7.2 关闭时序

- `minio` 客户端为无状态 HTTP 客户端，无需显式关闭连接池。
- 若未来引入长连接或自定义 agent，可补充 `close()` 方法。

## 8. 并发与性能行为

- `upload` 与 `download` 均为异步操作，支持并发调用。
- 大文件（>100MB）建议由调用方控制流背压（backpressure），本层不做额外分片。
- 不维护本地缓存，每次操作直接访问 MinIO。
