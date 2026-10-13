import { Router, Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService';

const router = Router();

// GET /api/dashboard
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = dashboardService.getDashboardData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
