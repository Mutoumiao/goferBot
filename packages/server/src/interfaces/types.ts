/** 所有实体基类型，约束 id 字段 */
export interface EntityBase {
  id: string
  createdAt?: Date
  updatedAt?: Date
}
