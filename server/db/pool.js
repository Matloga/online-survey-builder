import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { config } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool;

export function getPool() {
  if (!pool) {
    pool = new sql.ConnectionPool({
      ...config.sql,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      options: { encrypt: config.sql.options?.encrypt ?? false, trustServerCertificate: true },
    });
    pool.on('error', (err) => {
      console.error('[sql] idle pool error:', err.message);
    });
  }
  return pool;
}

export async function query(text, params = {}) {
  const request = getPool().request();
  for (const [name, value] of Object.entries(params)) {
    request.input(name, sqlTypeFor(value), value);
  }
  const result = await request.query(text);
  return result;
}

export async function withTransaction(fn) {
  const tx = new sql.Transaction(getPool());
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

export async function connect() {
  try {
    await getPool().connect();
    return true;
  } catch (err) {
    console.error(`[sql] connection failed: ${err.message}`);
    return false;
  }
}

export async function close() {
  if (pool) {
    await pool.close();
    pool = undefined;
  }
}

export async function runMigrations() {
  const file = path.join(__dirname, 'schema.sql');
  const script = fs.readFileSync(file, 'utf8');

  // GO batches must be split before sending, mssql rejects GO
  const batches = script
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter(Boolean);

  const pool_ = getPool();
  for (const batch of batches) {
    await new sql.Request(pool_).batch(batch);
  }
  return batches.length;
}

/**
 * mssql infers most types, but NVARCHAR(MAX)/JSON columns must be declared.
 */
function sqlTypeFor(value) {
  if (typeof value === 'boolean') return sql.Bit;
  if (typeof value === 'number') return sql.Float;
  if (value instanceof Date) return sql.DateTime2;
  return sql.NVarChar(sql.MAX);
}

export { sql };