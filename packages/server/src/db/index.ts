// db 实例
export { db } from './client.js';

// Schema 表定义与类型
export * from './schema.js';

// Drizzle ORM 工具函数（常用查询构建器）
export { eq, and, or, inArray, desc, asc } from 'drizzle-orm';
