import jwt from 'jsonwebtoken';
import { config } from '../db/env.js';
import { unauthorized, forbidden } from './error.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.UserId ?? user.id), email: user.Email, role: user.Role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

function readToken(req) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Rejects the request when no valid token is present. */
export function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(unauthorized('Please log in to continue'));

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch {
    return next(unauthorized('Your session has expired. Please log in again.'));
  }
}

/** Attaches req.user when a token is present but never blocks the request. */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, config.jwt.secret);
    } catch {
      req.user = undefined;
    }
  }
  next();
}

/** Role gate for admin-only routes. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('This action requires an administrator account'));
    }
    next();
  };
}