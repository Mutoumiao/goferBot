import { MilvusClient, DataType, type RowData } from '@zilliz/milvus2-sdk-node';
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '../interfaces/IVectorStore.js';
import { VectorStoreError } from '../interfaces/errors.js';

export interface MilvusVectorStoreOptions {
  /** Milvus 服务地址，默认 localhost */
  host?: string;
  /** Milvus gRPC 端口，默认 19530 */
  port?: string | number;
  /** Collection 名称，默认 'knowledge_chunks' */
  collectionName?: string;
  /** 向量维度，默认 1536 */
  vectorDim?: number;
  /** 相似度度量，默认 'COSINE' */
  metricType?: 'COSINE' | 'IP' | 'L2';
}

export class MilvusVectorStore implements IVectorStore {
  private client: MilvusClient;
  private readonly collectionName: string;
  private readonly vectorDim: number;
  private readonly metricType: 'COSINE' | 'IP' | 'L2';

  constructor(options: MilvusVectorStoreOptions = {}) {
    const host = options.host ?? process.env.MILVUS_HOST ?? 'localhost';
    const port = options.port ?? process.env.MILVUS_PORT ?? '19530';
    this.collectionName = options.collectionName ?? process.env.MILVUS_COLLECTION ?? 'knowledge_chunks';
    this.vectorDim = options.vectorDim ?? Number(process.env.MILVUS_VECTOR_DIM ?? 1536);
    this.metricType = options.metricType ?? 'COSINE';

    this.client = new MilvusClient({
      address: `${host}:${port}`,
    });
  }

  /** 启动时检查连接健康 */
  async checkHealth(): Promise<void> {
    try {
      const res = await this.client.checkHealth();
      if (!res.isHealthy) {
        throw new VectorStoreError('Milvus 连接失败: 服务未就绪');
      }
      console.log(`[Milvus] Connected to ${(this.client as any).config?.address ?? 'unknown'}`);
    } catch (err: any) {
      throw new VectorStoreError(`Milvus 连接失败: ${err?.message ?? err}`, err);
    }
  }

  /** 幂等地创建/校验 collection */
  async ensureCollection(): Promise<void> {
    try {
      const has = await this.client.hasCollection({
        collection_name: this.collectionName,
      });

      if (!has.value) {
        await this.client.createCollection({
          collection_name: this.collectionName,
          fields: [
            {
              name: 'id',
              data_type: DataType.VarChar,
              is_primary_key: true,
              max_length: 64,
            },
            {
              name: 'chunk_id',
              data_type: DataType.VarChar,
              max_length: 64,
            },
            {
              name: 'kb_id',
              data_type: DataType.VarChar,
              max_length: 64,
            },
            {
              name: 'file_id',
              data_type: DataType.VarChar,
              max_length: 64,
            },
            {
              name: 'embedding',
              data_type: DataType.FloatVector,
              dim: this.vectorDim,
            },
          ],
        });

        await this.client.createIndex({
          collection_name: this.collectionName,
          field_name: 'embedding',
          index_type: 'AUTOINDEX',
          metric_type: this.metricType,
        });

        await this.client.createIndex({
          collection_name: this.collectionName,
          field_name: 'kb_id',
          index_type: 'Trie',
        });

        await this.client.loadCollection({
          collection_name: this.collectionName,
        });

        console.log(`[Milvus] Collection '${this.collectionName}' created (dim=${this.vectorDim})`);
        return;
      }

      // 已存在：校验维度并确保加载
      const desc = await this.client.describeCollection({
        collection_name: this.collectionName,
      });

      const embField = desc.schema.fields.find((f) => f.name === 'embedding');
      const actualDim = embField?.type_params?.find((p) => p.key === 'dim')?.value;
      if (actualDim && Number(actualDim) !== this.vectorDim) {
        throw new VectorStoreError(
          `Collection 维度不匹配: 期望 ${this.vectorDim}, 实际 ${actualDim}`
        );
      }

      await this.client.loadCollection({
        collection_name: this.collectionName,
      });

      console.log(`[Milvus] Collection '${this.collectionName}' already exists, verified`);
    } catch (err: any) {
      if (err instanceof VectorStoreError) throw err;
      throw new VectorStoreError(`ensureCollection 失败: ${err?.message ?? err}`, err);
    }
  }

  /** 批量插入向量 */
  async insertVectors(vectors: VectorRecord[]): Promise<void> {
    if (!vectors.length) {
      throw new VectorStoreError('insertVectors 参数不能为空数组');
    }
    if (vectors.length > 1000) {
      throw new VectorStoreError('单次插入不得超过 1000 条');
    }

    for (const v of vectors) {
      if (v.embedding.length !== this.vectorDim) {
        throw new VectorStoreError(
          `维度不匹配: 期望 ${this.vectorDim}, 实际 ${v.embedding.length}`
        );
      }
    }

    const data = vectors.map((v) => ({
      id: v.id,
      chunk_id: v.chunkId,
      kb_id: v.kbId,
      file_id: v.fileId,
      embedding: v.embedding,
    }));

    try {
      const res = await this.client.insert({
        collection_name: this.collectionName,
        data,
      } as any);
      if (res.status.error_code !== 'Success') {
        throw new VectorStoreError(`向量插入失败: ${res.status.reason}`);
      }
      await this.client.flush({ collection_names: [this.collectionName] });
      console.log(`[Milvus] Inserted ${vectors.length} vectors into '${this.collectionName}'`);
    } catch (err: any) {
      if (err instanceof VectorStoreError) throw err;
      throw new VectorStoreError(`向量插入失败: ${err?.message ?? err}`, err);
    }
  }

  /** ANN 搜索 */
  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    if (queryVector.length !== this.vectorDim) {
      throw new VectorStoreError(
        `维度不匹配: 期望 ${this.vectorDim}, 实际 ${queryVector.length}`
      );
    }

    const topK = options?.topK ?? 5;
    const filterParts: string[] = [];
    if (options?.filter?.kbId) {
      filterParts.push(`kb_id == "${options.filter.kbId}"`);
    }
    const expr = filterParts.length ? filterParts.join(' && ') : undefined;

    try {
      const res = await this.client.search({
        collection_name: this.collectionName,
        vector: queryVector,
        filter: expr,
        limit: topK,
        output_fields: ['chunk_id', 'id'],
      });

      if (res.status.error_code !== 'Success') {
        throw new VectorStoreError(`搜索失败: ${res.status.reason}`);
      }

      const results: VectorSearchResult[] = (res.results ?? []).map((r: any) => ({
        id: String(r.id),
        chunkId: String(r.chunk_id),
        score: Number(r.score),
      }));

      results.sort((a, b) => b.score - a.score);

      console.log(
        `[Milvus] Searched '${this.collectionName}', topK=${topK}, filter=${expr ?? 'none'}, results=${results.length}`
      );
      return results;
    } catch (err: any) {
      if (err instanceof VectorStoreError) throw err;
      throw new VectorStoreError(`搜索失败: ${err?.message ?? err}`, err);
    }
  }

  /** 按 Milvus 主键删除 */
  async deleteByIds(ids: string[]): Promise<void> {
    if (!ids.length) {
      throw new VectorStoreError('deleteByIds 参数不能为空数组');
    }

    const quoted = ids.map((id) => `"${id}"`).join(',');
    const expr = `id in [${quoted}]`;

    try {
      const res = await this.client.delete({
        collection_name: this.collectionName,
        filter: expr,
      } as any);
      if (res.status.error_code !== 'Success') {
        throw new VectorStoreError(`向量删除失败: ${res.status.reason}`);
      }
      await this.client.flush({ collection_names: [this.collectionName] });
      console.log(`[Milvus] Deleted vectors from '${this.collectionName}', expr=${expr}`);
    } catch (err: any) {
      if (err instanceof VectorStoreError) throw err;
      throw new VectorStoreError(`向量删除失败: ${err?.message ?? err}`, err);
    }
  }

  /** 按 file_id 删除（实现类扩展） */
  async deleteByFileId(fileId: string): Promise<void> {
    const expr = `file_id == "${fileId}"`;
    try {
      const res = await this.client.delete({
        collection_name: this.collectionName,
        filter: expr,
      } as any);
      if (res.status.error_code !== 'Success') {
        throw new VectorStoreError(`向量删除失败: ${res.status.reason}`);
      }
      await this.client.flush({ collection_names: [this.collectionName] });
      console.log(`[Milvus] Deleted vectors by file_id from '${this.collectionName}', expr=${expr}`);
    } catch (err: any) {
      if (err instanceof VectorStoreError) throw err;
      throw new VectorStoreError(`向量删除失败: ${err?.message ?? err}`, err);
    }
  }

  /** 按 kb_id 删除（实现类扩展） */
  async deleteByKbId(kbId: string): Promise<void> {
    const expr = `kb_id == "${kbId}"`;
    try {
      const res = await this.client.delete({
        collection_name: this.collectionName,
        filter: expr,
      } as any);
      if (res.status.error_code !== 'Success') {
        throw new VectorStoreError(`向量删除失败: ${res.status.reason}`);
      }
      await this.client.flush({ collection_names: [this.collectionName] });
      console.log(`[Milvus] Deleted vectors by kb_id from '${this.collectionName}', expr=${expr}`);
    } catch (err: any) {
      if (err instanceof VectorStoreError) throw err;
      throw new VectorStoreError(`向量删除失败: ${err?.message ?? err}`, err);
    }
  }
}
