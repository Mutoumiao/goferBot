# 核心接口测试用例

## TC-01: IRepository 泛型约束编译通过
- **触发**: 定义测试类型 `interface TestEntity { id: string; name: string }`
- **预期**: `IRepository<TestEntity>` 不报错
- **验证**: `pnpm type-check` 通过

## TC-02: IStorageProvider 方法签名完整
- **触发**: 检查 `packages/server/src/interfaces/IStorageProvider.ts`
- **预期**: 包含 `upload`、`download`、`delete`、`getUrl` 方法
- **验证**: `grep -E "upload|download|delete|getUrl" packages/server/src/interfaces/IStorageProvider.ts`

## TC-03: IVectorStore 向量维度可配置
- **触发**: 检查 `ensureCollection` 方法签名
- **预期**: 接受 `dimension: number` 参数，不硬编码 1536
- **验证**: `grep "dimension" packages/server/src/interfaces/IVectorStore.ts`

## TC-04: IAuthProvider middleware 返回 Hono MiddlewareHandler
- **触发**: 检查 `middleware()` 返回类型
- **预期**: 返回类型为 `MiddlewareHandler` 或兼容类型
- **验证**: `grep "middleware" packages/server/src/interfaces/IAuthProvider.ts`

## TC-05: 统一导出文件存在
- **触发**: 检查 `packages/server/src/interfaces/index.ts`
- **预期**: 导出所有四个接口
- **验证**: `cat packages/server/src/interfaces/index.ts`

## TC-06: 错误类型可实例化
- **触发**: 尝试 `new NotFoundError('test')`
- **预期**: 可正常实例化，有 message 和 code 属性
- **验证**: 编写临时测试文件编译运行

## TC-07: 接口与 PRD 数据模型一致
- **触发**: 对比 PRD 中的 User/KnowledgeBase/Document 等模型
- **预期**: IRepository 泛型参数可接受这些类型
- **验证**: 手动检查类型兼容性
