import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot',
  max: 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle({ client: pool });

// 优雅关闭连接池
process.on('beforeExit', async () => {
  await pool.end();
});
