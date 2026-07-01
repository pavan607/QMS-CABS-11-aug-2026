import 'dotenv/config';
import { Pool } from 'pg';
import { resolveDatabaseUrl } from '@/lib/database-url';

const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
});

// Convenience function for queries
export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export default pool;

