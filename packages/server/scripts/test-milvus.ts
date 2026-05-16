import { MilvusVectorStore } from '../src/vector/milvus.js';
import { VectorStoreError } from '../src/interfaces/errors.js';

async function main() {
  const store = new MilvusVectorStore({
    collectionName: 'test_knowledge_chunks',
    vectorDim: 4,
  });

  // 1. 连接检查
  console.log('--- 1. checkHealth ---');
  await store.checkHealth();

  // 2. 创建/校验 collection
  console.log('--- 2. ensureCollection ---');
  await store.ensureCollection();

  // 3. 插入向量
  console.log('--- 3. insertVectors ---');
  await store.insertVectors([
    {
      id: 'vec-001',
      chunkId: 'chunk-001',
      kbId: 'kb-001',
      fileId: 'file-001',
      embedding: [1, 0, 0, 0],
    },
    {
      id: 'vec-002',
      chunkId: 'chunk-002',
      kbId: 'kb-001',
      fileId: 'file-001',
      embedding: [0, 1, 0, 0],
    },
    {
      id: 'vec-003',
      chunkId: 'chunk-003',
      kbId: 'kb-002',
      fileId: 'file-002',
      embedding: [0, 0, 1, 0],
    },
  ]);

  // 4. 搜索（无过滤）
  console.log('--- 4. searchVectors (no filter) ---');
  const resultsAll = await store.searchVectors([1, 0, 0, 0], { topK: 3 });
  console.log(resultsAll);

  // 5. 搜索（带 kb_id 过滤）
  console.log('--- 5. searchVectors (kbId filter) ---');
  const resultsFiltered = await store.searchVectors([1, 0, 0, 0], {
    topK: 3,
    filter: { kbId: 'kb-001' },
  });
  console.log(resultsFiltered);

  // 6. 删除指定 ID
  console.log('--- 6. deleteByIds ---');
  await store.deleteByIds(['vec-003']);

  // 7. 再次搜索确认删除（flush 后需等待索引构建）
  console.log('--- 7. search after delete ---');
  await new Promise((r) => setTimeout(r, 3000));
  const resultsAfterDelete = await store.searchVectors([0, 0, 1, 0], { topK: 3 });
  console.log(resultsAfterDelete);

  // 8. 清理 collection
  console.log('--- 8. cleanup ---');
  const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
  const client = new MilvusClient({
    address: `${process.env.MILVUS_HOST ?? 'localhost'}:${process.env.MILVUS_PORT ?? '19530'}`,
  });
  await client.dropCollection({ collection_name: 'test_knowledge_chunks' });
  console.log('测试完成，临时 collection 已清理');
}

main().catch((err) => {
  if (err instanceof VectorStoreError) {
    console.error('[VectorStoreError]', err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
