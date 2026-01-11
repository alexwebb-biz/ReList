/**
 * PostgreSQL Direct Connection
 * Used when running with local PostgreSQL instead of Supabase
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

let pool: pg.Pool | null = null;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('connect', () => {
    console.log('PostgreSQL pool connection established');
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
}

export { pool };
export default pool;
