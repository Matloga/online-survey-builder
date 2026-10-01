import { connect, runMigrations, close } from './pool.js';
import { config } from './env.js';

const ok = await connect();
if (!ok) {
  console.error('Could not connect to SQL Server. Check SQLSERVER_CONNECTION_STRING in server/.env');
  process.exit(1);
}

console.log(`[migrate] connected to ${config.sql.server}/${config.sql.database}`);

try {
  const count = await runMigrations();
  console.log(`[migrate] applied ${count} batch(es). Schema is up to date.`);
} catch (err) {
  console.error('[migrate] failed:', err.message);
  process.exitCode = 1;
} finally {
  await close();
}