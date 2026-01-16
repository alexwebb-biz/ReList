import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticateToken, verifyRefreshToken, generateToken, generateRefreshToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const validatedData = signupSchema.parse(req.body);
    const result = await authService.signup(validatedData);
    sendSuccess(res, result, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'Email already registered') {
        sendError(res, 'EMAIL_EXISTS', error.message, 409, 'email');
        return;
      }
      sendError(res, 'SIGNUP_ERROR', error.message, 500);
      return;
    }
    sendError(res, 'UNKNOWN_ERROR', 'An unexpected error occurred', 500);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);
    sendSuccess(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'Invalid email or password') {
        sendError(res, 'INVALID_CREDENTIALS', error.message, 401);
        return;
      }
      sendError(res, 'LOGIN_ERROR', error.message, 500);
      return;
    }
    sendError(res, 'UNKNOWN_ERROR', 'An unexpected error occurred', 500);
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  // With JWT, logout is handled client-side by removing the token
  // This endpoint exists for API consistency and potential future token blacklisting
  sendSuccess(res, { message: 'Logged out successfully' });
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const user = await authService.getUserById(req.user.id);
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', 'Failed to fetch user', 500);
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken: token } = refreshSchema.parse(req.body);

    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      sendError(res, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
      return;
    }

    // Verify user still exists
    const user = await authService.getUserById(decoded.id);
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User no longer exists', 401);
      return;
    }

    // Generate new tokens
    const newToken = generateToken({ id: decoded.id, email: decoded.email });
    const newRefreshToken = generateRefreshToken({ id: decoded.id, email: decoded.email });

    sendSuccess(res, {
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    sendError(res, 'REFRESH_ERROR', 'Failed to refresh token', 500);
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const result = await authService.createPasswordResetToken(email);

    // Always return success to prevent email enumeration
    sendSuccess(res, {
      message: 'If an account with that email exists, a password reset link has been sent.',
      // In development, include the token for testing (remove in production)
      ...(process.env.NODE_ENV === 'development' && result?.token && { debug_token: result.token }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    // Still return success to prevent email enumeration
    sendSuccess(res, {
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    await authService.resetPassword(token, password);

    sendSuccess(res, {
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'Invalid or expired reset token') {
        sendError(res, 'INVALID_RESET_TOKEN', error.message, 400);
        return;
      }
    }
    sendError(res, 'RESET_ERROR', 'Failed to reset password', 500);
  }
});

export default router;
