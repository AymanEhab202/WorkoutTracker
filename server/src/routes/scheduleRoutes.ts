import { Router, Request, Response, NextFunction } from 'express';
import { scheduleService } from '../services/scheduleService';
import { WeeklyScheduleUpdateSchema } from '@shared/schemas';

const router = Router();

// GET /api/schedule
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = scheduleService.getSchedule();
    res.json(schedule);
  } catch (error) {
    next(error);
  }
});

// PUT /api/schedule
router.put('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = WeeklyScheduleUpdateSchema.parse(req.body);
    const schedule = scheduleService.updateSchedule(validated.entries, validated.target_frequency);
    res.json(schedule);
  } catch (error) {
    next(error);
  }
});

export default router;
