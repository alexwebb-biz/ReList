import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import supabase from '../config/supabase.js';
import { User } from '../types/index.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';

const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_HOURS = 1;

export interface SignupData {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResult {
  user: Omit<User, 'password_hash'>;
  token: string;
  refreshToken: string;
}

export const signup = async (data: SignupData): Promise<AuthResult> => {
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', data.email.toLowerCase())
    .single();

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);

  // Create user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      email: data.email.toLowerCase(),
      password_hash,
      full_name: data.full_name || null,
    })
    .select()
    .single();

  if (error || !newUser) {
    throw new Error(error?.message || 'Failed to create user');
  }

  // Generate tokens
  const token = generateToken({ id: newUser.id, email: newUser.email });
  const refreshToken = generateRefreshToken({ id: newUser.id, email: newUser.email });

  // Remove password_hash from response
  const { password_hash: _, ...userWithoutPassword } = newUser;

  return {
    user: userWithoutPassword,
    token,
    refreshToken,
  };
};

export const login = async (data: LoginData): Promise<AuthResult> => {
  // Find user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', data.email.toLowerCase())
    .single();

  if (error || !user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  // Generate tokens
  const token = generateToken({ id: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

  // Remove password_hash from response
  const { password_hash: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    token,
    refreshToken,
  };
};

export const getUserById = async (id: string): Promise<Omit<User, 'password_hash'> | null> => {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !user) {
    return null;
  }

  const { password_hash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// Password reset functions
export const createPasswordResetToken = async (email: string): Promise<{ token: string } | null> => {
  // Find user by email
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .single();

  if (!user) {
    // Return null but don't throw - we don't want to reveal if email exists
    return null;
  }

  // Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Store the token hash in a password_resets table or in the user record
  // For simplicity, we'll add columns to users table (you may want a separate table)
  const { error } = await supabase
    .from('users')
    .update({
      reset_token_hash: tokenHash,
      reset_token_expires: expiresAt.toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to store reset token:', error);
    return null;
  }

  // In production, send email here with the reset link
  // For now, return the token (only in development)
  console.log(`Password reset token for ${email}: ${token}`);

  return { token };
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  // Hash the provided token to compare with stored hash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find user with this token that hasn't expired
  const { data: user, error } = await supabase
    .from('users')
    .select('id, reset_token_expires')
    .eq('reset_token_hash', tokenHash)
    .single();

  if (error || !user) {
    throw new Error('Invalid or expired reset token');
  }

  // Check if token has expired
  if (new Date(user.reset_token_expires) < new Date()) {
    throw new Error('Invalid or expired reset token');
  }

  // Hash new password
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password and clear reset token
  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash,
      reset_token_hash: null,
      reset_token_expires: null,
    })
    .eq('id', user.id);

  if (updateError) {
    throw new Error('Failed to reset password');
  }
};
