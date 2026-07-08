# GoferBot Discovery Report

## 7. 复杂模块

### 7.14 Storage 存储层 — MinIO 4 层抽象架构

**数据来源**：[IStorageProvider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/interfaces/IStorageProvider.ts)、[storage.provider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.provider.ts)、[storage.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.service.ts)、[minio.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/storage/minio.ts)

```
IStorageProvider (接口：upload/download/delete/getUrl/extractKey/getPresignedUrl)
    ↑
StorageService (门面：ensureProvider() 延迟守卫)
    ↑ 注入 STORAGE_PROVIDER
FactoryProvider (环境变量读取 → MinIO 初始化 → bucket 自动创建)
    ↑
MinIOStorageProvider (minio SDK 封装)
```

**优雅降级设计**：
- FactoryProvider 在环境变量缺失时返回 `null`（不阻塞应用启动）
- StorageService 所有公开方法调用前经 `ensureProvider()` 守卫：未配置时抛 `STORAGE_NOT_CONFIGURED` (503)
- 方案选择原因：`null` 注入 + 运行时守卫 而非 `@Optional()` + try-catch，保证错误信息精确且延迟到实际使用时才报错

**MinIO 特性**：
- 自动创建 bucket（initialize 时 `bucketExists → makeBucket`）
- HTTP/HTTPS 双协议支持
- URL 格式：`{protocol}//{endpoint}:{port}/{bucket}/{key}`
- 下载使用流式读取（`getObject → stream → Buffer.concat`），避免大文件内存溢出
- 预签名上传 URL（`presignedPutObject`），默认 3600s 过期
