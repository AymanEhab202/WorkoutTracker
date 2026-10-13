import { Router, Request, Response, NextFunction } from 'express';
import { goalService } from '../services/goalService';
import { GoalSchema } from '@shared/schemas';
import { GoalStatus } from '@shared/types';

const router = Router();

// GET /api/goals
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as GoalStatus | undefined;
    const goals = goalService.list({ status });
    res.json(goals);
  } catch (error) {
    next(error);
  }
});

// GET /api/goals/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const goal = goalService.getById(req.params.id);
    if (!goal) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json(goal);
  } catch (error) {
    next(error);
  }
});

// POST /api/goals
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = GoalSchema.parse(req.body);
    const goal = goalService.create(validated);
    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
});

// PUT /api/goals/:id
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = GoalSchema.partial().parse(req.body);
    const goal = goalService.update(req.params.id, validated);
    res.json(goal);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/goals/:id
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    goalService.delete(req.params.id);
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
