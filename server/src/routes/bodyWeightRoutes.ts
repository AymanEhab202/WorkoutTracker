import { Router, Request, Response, NextFunction } from 'express';
import { bodyWeightService } from '../services/bodyWeightService';
import { BodyWeightSchema } from '@shared/schemas';

const router = Router();

// GET /api/body-weight
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const entries = bodyWeightService.list({ startDate, endDate });
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

// GET /api/body-weight/stats
router.get('/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = bodyWeightService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/body-weight/history
router.get('/history', (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = bodyWeightService.getHistoryWithRollingAverage();
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// POST /api/body-weight
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = BodyWeightSchema.parse(req.body);
    const entry = bodyWeightService.create(validated);
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

// PUT /api/body-weight/:id
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = BodyWeightSchema.partial().parse(req.body);
    const entry = bodyWeightService.update(req.params.id, validated);
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/body-weight/:id
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    bodyWeightService.delete(req.params.id);
    res.json({ message: 'Measurement deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
