import { query } from '../db/pool.js';
import { hashPassword } from './password.js';

const PUBLIC_COLUMNS = 'UserId, Email, Name, Role, CreatedAt, UpdatedAt';

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.UserId,
    email: row.Email,
    name: row.Name,
    role: row.Role,
    createdAt: row.CreatedAt,
  };
}

export async function findByEmail(email) {
  const { recordset } = await query(
    `SELECT UserId, Email, Name, Role, PasswordHash, CreatedAt
     FROM dbo.Users WHERE Email = @email`,
    { email },
  );
  return recordset[0] || null;
}

export async function findById(id) {
  const { recordset } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM dbo.Users WHERE UserId = @id`,
    { id },
  );
  return recordset[0] || null;
}

export async function createUser({ email, password, name }) {
  const passwordHash = await hashPassword(password);
  const { recordset } = await query(
    `INSERT INTO dbo.Users (Email, PasswordHash, Name)
     OUTPUT INSERTED.${PUBLIC_COLUMNS.split(', ').join(', INSERTED.')}
     VALUES (@email, @passwordHash, @name)`,
    { email, passwordHash, name },
  );
  return recordset[0];
}

export async function updateProfile(id, { name, email }) {
  const sets = ['UpdatedAt = SYSUTCDATETIME()'];
  const params = { id };
  if (name !== undefined) {
    sets.push('Name = @name');
    params.name = name;
  }
  if (email !== undefined) {
    sets.push('Email = @email');
    params.email = email;
  }
  const { recordset } = await query(
    `UPDATE dbo.Users SET ${sets.join(', ')}
     OUTPUT INSERTED.${PUBLIC_COLUMNS.split(', ').join(', INSERTED.')}
     WHERE UserId = @id`,
    params,
  );
  return recordset[0] || null;
}

export async function updatePassword(id, newPassword) {
  const passwordHash = await hashPassword(newPassword);
  const result = await query(
    `UPDATE dbo.Users
     SET PasswordHash = @passwordHash, UpdatedAt = SYSUTCDATETIME()
     WHERE UserId = @id`,
    { id, passwordHash },
  );
  return result.rowsAffected[0] > 0;
}

export async function countSurveysByOwner(id) {
  const { recordset } = await query(
    'SELECT COUNT(*) AS Total FROM dbo.Surveys WHERE OwnerId = @id',
    { id },
  );
  return recordset[0].Total;
}