import { connect, close, query } from '../db/pool.js';
import { config } from '../db/env.js';
import * as userModel from '../models/user.model.js';

const ok = await connect();
if (!ok) {
  console.error('Could not connect to SQL Server. Check SQLSERVER_CONNECTION_STRING in server/.env');
  process.exit(1);
}

const existing = await userModel.findByEmail(config.seed.email);
if (existing) {
  console.log(`[seed] ${config.seed.email} already exists (UserId ${existing.UserId}). Nothing to do.`);
} else {
  const user = await userModel.createUser({
    email: config.seed.email,
    password: config.seed.password,
    name: config.seed.name,
  });
  await query(
    "UPDATE dbo.Users SET Role = 'admin' WHERE UserId = @id",
    { id: user.UserId },
  );
  console.log(`[seed] created admin ${config.seed.email} (UserId ${user.UserId})`);
}

const { recordset } = await query(
  `SELECT
     (SELECT COUNT(*) FROM dbo.Users) AS Users,
     (SELECT COUNT(*) FROM dbo.Surveys) AS Surveys,
     (SELECT COUNT(*) FROM dbo.Questions) AS Questions,
     (SELECT COUNT(*) FROM dbo.Responses) AS Responses`,
);

console.log('[seed] row counts:', recordset[0]);
await close();