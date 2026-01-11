import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';

// Admin email - only this user can access admin routes
const ADMIN_EMAIL = 'alexjwebb13@gmail.com';

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Check if user is authenticated
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};
