# API 规格：Milvus 代码清理

## 删除文件清单

| 文件 | 说明 | 替代方案 |
|------|------|----------|
| `packages/server/src/vector/milvus.ts` | MilvusVectorStore 类 | `packages/server/src/vector/pgvector.ts` |
| `packages/server/src/processors/indexing/prisma-milvus.indexer.ts` | PrismaMilvusIndexer 类 | `packages/server/src/processors/indexing/prisma-vector.indexer.ts` |

## 依赖清理

### package.json

```json
// 移除
"@zilliz/milvus2-sdk-node": "^x.x.x"
```

### 环境变量

```bash
# 移除
MILVUS_HOST
MILVUS_PORT
MILVUS_COLLECTION
MILVUS_VECTOR_DIM
```

## 引用检查命令

```bash
# 检查 MilvusVectorStore 引用
grep -r "MilvusVectorStore" packages/server/src/ --include="*.ts"

# 检查 PrismaMilvusIndexer 引用
grep -r "PrismaMilvusIndexer" packages/server/src/ --include="*.ts"

# 检查 MILVUS_ 环境变量引用
grep -r "MILVUS_" packages/server/src/ --include="*.ts"

# 检查 milvus 文件引用
grep -r "from.*milvus" packages/server/src/ --include="*.ts"
```

## 验证命令

```bash
# 重新安装依赖
pnpm install

# 确认 node_modules 无 milvus 包
ls node_modules/@zilliz 2>/dev/null || echo "No @zilliz packages"

# 类型检查
pnpm type-check

# 单元测试
npx vitest run tests/unit
```

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 无引用残留 | 无自动化测试 | 人工验证：grep 命令无输出 |
| 依赖清理 | 无自动化测试 | 人工验证：pnpm install 后无 milvus 包 |
| 功能正常 | 全部单元测试 | AC-01: pnpm type-check + npx vitest run 通过 |
