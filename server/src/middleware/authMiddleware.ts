import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { UserProfile } from '@shared/types';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // If no owner is configured yet, reject with setup required
  if (!authService.hasOwner()) {
    res.status(403).json({ error: 'Initial owner setup required', setup_required: true });
    return;
  }

  const token = req.cookies?.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = authService.validateSession(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = user;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    const user = authService.validateSession(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}
