import { Router, Request, Response, NextFunction } from 'express';
import { exerciseService } from '../services/exerciseService';
import { ExerciseSchema } from '@shared/schemas';

const router = Router();

// GET /api/exercises
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const exercises = exerciseService.list({ includeArchived, category });
    res.json(exercises);
  } catch (error) {
    next(error);
  }
});

// GET /api/exercises/categories
router.get('/categories', (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = exerciseService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/exercises/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const exercise = exerciseService.getById(req.params.id);
    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }
    res.json(exercise);
  } catch (error) {
    next(error);
  }
});

// POST /api/exercises
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = ExerciseSchema.parse(req.body);
    const exercise = exerciseService.create(validated);
    res.status(201).json(exercise);
  } catch (error) {
    next(error);
  }
});

// PUT /api/exercises/:id
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = ExerciseSchema.partial().parse(req.body);
    const exercise = exerciseService.update(req.params.id, validated);
    res.json(exercise);
  } catch (error) {
    next(error);
  }
});

// POST /api/exercises/:id/archive
router.post('/:id/archive', (req: Request, res: Response, next: NextFunction) => {
  try {
    const exercise = exerciseService.archive(req.params.id);
    res.json(exercise);
  } catch (error) {
    next(error);
  }
});

// POST /api/exercises/:id/unarchive
router.post('/:id/unarchive', (req: Request, res: Response, next: NextFunction) => {
  try {
    const exercise = exerciseService.unarchive(req.params.id);
    res.json(exercise);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    exerciseService.delete(req.params.id);
    res.json({ message: 'Exercise deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
