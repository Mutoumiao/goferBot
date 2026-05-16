import type { EntityBase } from './types.js'
import type { NotFoundError, ConflictError, ValidationError } from './errors.js'

/** 分页与排序选项 */
export interface RepositoryFindOptions {
  /** 返回记录数上限，默认 100 */
  limit?: number
  /** 跳过记录数，默认 0 */
  offset?: number
  /** 排序字段，格式为 "field:asc" 或 "field:desc" */
  orderBy?: string
}

/**
 * 泛型数据访问接口，覆盖所有 PostgreSQL 元数据表。
 *
 * @typeParam T - 实体类型，必须包含 `id: string`
 */
export interface IRepository<T extends { id: string }> {
  /**
   * 根据主键查找单条记录。
   * @param id — 实体主键（UUID）
   * @returns 完整实体对象
   * @throws NotFoundError — 记录不存在时抛出
   */
  findById(id: string): Promise<T>

  /**
   * 分页/排序查询所有记录。
   * @param options — 可选分页与排序参数
   * @returns 实体数组（空数组表示无记录，不抛异常）
   */
  findAll(options?: RepositoryFindOptions): Promise<T[]>

  /**
   * 创建新记录。
   * @param data — 除 id 外的实体字段；id 由实现层生成（UUID v4）
   * @returns 创建后的完整实体（含生成的 id、createdAt、updatedAt）
   * @throws ConflictError — 唯一键冲突（如邮箱已存在）
   * @throws ValidationError — 必填字段缺失或格式非法
   */
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>

  /**
   * 根据主键更新记录。
   * @param id — 实体主键
   * @param data — 部分字段更新（不允许修改 id）
   * @returns 更新后的完整实体
   * @throws NotFoundError — 记录不存在时抛出
   */
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>

  /**
   * 根据主键删除记录。
   * @param id — 实体主键
   * @returns void
   * @throws NotFoundError — 记录不存在时抛出（实现也可选择静默成功）
   */
  delete(id: string): Promise<void>
}
