import { Router, Request, Response, NextFunction } from 'express';
import { templateService } from '../services/templateService';
import { WorkoutTemplateSchema } from '@shared/schemas';

const router = Router();

// GET /api/templates
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const templates = templateService.list({ includeArchived });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// GET /api/templates/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = templateService.getById(req.params.id);
    if (!template) {
      res.status(404).json({ error: 'Workout template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// POST /api/templates
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = WorkoutTemplateSchema.parse(req.body);
    const template = templateService.create(validated);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// PUT /api/templates/:id
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = WorkoutTemplateSchema.partial().parse(req.body);
    const template = templateService.update(req.params.id, validated);
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// POST /api/templates/:id/archive
router.post('/:id/archive', (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = templateService.archive(req.params.id);
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// POST /api/templates/:id/unarchive
router.post('/:id/unarchive', (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = templateService.unarchive(req.params.id);
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/templates/:id
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    templateService.delete(req.params.id);
    res.json({ message: 'Workout template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
