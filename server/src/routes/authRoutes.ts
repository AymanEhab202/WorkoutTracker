import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { loginLimiter } from '../middleware/rateLimiter';
import { OwnerSetupSchema, LoginSchema, ChangePasswordSchema } from '@shared/schemas';

const router = Router();

// GET /api/auth/status
router.get('/status', (req: Request, res: Response) => {
  const isConfigured = authService.hasOwner();
  const token = req.cookies?.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const user = token ? authService.validateSession(token) : null;

  res.json({
    isConfigured,
    isAuthenticated: !!user,
    user: user || null,
  });
});

// POST /api/auth/setup (First-run owner creation)
router.post('/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = OwnerSetupSchema.parse(req.body);
    const user = await authService.createOwner(validated.username, validated.password);
    const { token, expiresAt } = authService.createSession(user.id);

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
    });

    res.status(201).json({
      message: 'Owner account created successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = LoginSchema.parse(req.body);
    const user = await authService.verifyOwner(validated.username, validated.password);

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const { token, expiresAt } = authService.createSession(user.id);

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
    });

    res.json({
      message: 'Logged in successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const token = req.cookies?.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    authService.deleteSession(token);
  }
  res.clearCookie('session_token');
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = ChangePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, validated.current_password, validated.new_password);
    res.clearCookie('session_token');
    res.json({ message: 'Password updated successfully. Please log in with your new password.' });
  } catch (error) {
    next(error);
  }
});

export default router;
