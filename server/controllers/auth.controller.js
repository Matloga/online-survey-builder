import { asyncHandler, badRequest, unauthorized, conflict } from '../middleware/error.js';
import { signToken } from '../middleware/auth.js';
import { z } from 'zod';
import * as userModel from '../models/user.model.js';
import { verifyPassword } from '../models/password.js';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
});

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  if (await userModel.findByEmail(email)) {
    throw conflict('An account with that email already exists');
  }

  const created = await userModel.createUser({ email, password, name });
  res.status(201).json({
    token: signToken(created),
    user: userModel.toPublicUser(created),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const row = await userModel.findByEmail(email);

  if (!row || !(await verifyPassword(password, row.PasswordHash))) {
    throw unauthorized('Incorrect email or password');
  }

  const user = userModel.toPublicUser(row);
  res.json({ token: signToken(row), user });
});

export const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(Number(req.user.sub));
  if (!user) throw unauthorized('Account no longer exists');
  res.json({ user: userModel.toPublicUser(user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = Number(req.user.sub);
  const payload = req.body;

  if (payload.email && payload.email !== req.user.email) {
    const existing = await userModel.findByEmail(payload.email);
    if (existing && existing.UserId !== userId) {
      throw conflict('An account with that email already exists');
    }
  }

  const updated = await userModel.updateProfile(userId, payload);
  res.json({ user: userModel.toPublicUser(updated) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const row = await userModel.findById(Number(req.user.sub));

  if (!row || !(await verifyPassword(currentPassword, row.PasswordHash))) {
    throw badRequest('Current password is incorrect', {
      currentPassword: 'Current password is incorrect',
    });
  }

  await userModel.updatePassword(Number(req.user.sub), newPassword);
  res.json({ message: 'Password updated' });
});