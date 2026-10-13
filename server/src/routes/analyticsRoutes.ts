import { Router, Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analyticsService';

const router = Router();

// GET /api/analytics
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = (req.query.range as '7d' | '30d' | '90d' | 'all') || '30d';
    const exerciseId = typeof req.query.exerciseId === 'string' ? req.query.exerciseId : undefined;
    const data = analyticsService.getAnalytics({ range, exerciseId });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
