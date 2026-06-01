-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 添加 embedding 列
ALTER TABLE "chunks" ADD COLUMN "embedding" vector(1536);

-- 移除 milvus_id 列
ALTER TABLE "chunks" DROP COLUMN IF EXISTS "milvus_id";

-- 创建 HNSW 索引用于相似度搜索
CREATE INDEX IF NOT EXISTS "chunks_embedding_hnsw" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);
