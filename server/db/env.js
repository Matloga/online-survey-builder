import 'dotenv/config';
import { config as validate } from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

validate({ path: path.resolve(__dirname, '../.env') });

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const isProduction = process.env.NODE_ENV === 'production';

const connectionString = required(
  'SQLSERVER_CONNECTION_STRING',
  'Server=localhost,1433;Database=SurveyBuilder;User Id=sa;Password=;Encrypt=false;TrustServerCertificate=true',
);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  isProduction,

  sql: {
    ...parseConnectionString(connectionString),
  },

  jwt: {
    secret: required('JWT_SECRET', isProduction ? undefined : 'dev-only-insecure-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  seed: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
    name: process.env.SEED_ADMIN_NAME || 'Admin',
  },
};

/**
 * mssql accepts either a connection string (parsed here) or a config object.
 * Keys map 1:1 from the ADO.NET-style string used in .env.
 */
function parseConnectionString(str) {
  const cs = {};
  for (const part of str.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;

    switch (key.toLowerCase()) {
      case 'server':
      case 'data source':
      case 'address':
        cs.server = value;
        break;
      case 'port':
        cs.port = Number(value);
        break;
      case 'database':
      case 'initial catalog':
        cs.database = value;
        break;
      case 'user id':
      case 'uid':
      case 'user':
        cs.user = value;
        break;
      case 'password':
      case 'pwd':
        cs.password = value;
        break;
      case 'encrypt':
        cs.options = { ...cs.options, encrypt: /^true$/i.test(value) };
        break;
      case 'trustservercertificate':
        cs.options = { ...cs.options, trustServerCertificate: /^true$/i.test(value) };
        break;
      default:
        break;
    }
  }
  if (!cs.server) throw new Error('SQLSERVER_CONNECTION_STRING is missing a Server');
  cs.database = cs.database || 'SurveyBuilder';
  return cs;
}

/** Opaque, non-reversible key for one-response-per-guest enforcement. */
export function guestKeyFor(surveyId, ip, userAgent) {
  const secret = config.jwt.secret;
  return crypto
    .createHash('sha256')
    .update(`${surveyId}|${ip}|${userAgent || ''}|${secret}`)
    .digest('hex')
    .slice(0, 48);
}