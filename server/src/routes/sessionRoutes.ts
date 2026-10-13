import { Router, Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/sessionService';
import {
  StartSessionSchema,
  UpdateSetSchema,
  AddExtraSetSchema,
  AddSessionExerciseSchema,
  FinishSessionSchema,
} from '@shared/schemas';
import { SessionStatus } from '@shared/types';

const router = Router();

// GET /api/sessions/active
router.get('/active', (req: Request, res: Response, next: NextFunction) => {
  try {
    const active = sessionService.getActiveSession();
    res.json(active);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions (History with filters)
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const status = req.query.status as SessionStatus | undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const exerciseId = typeof req.query.exerciseId === 'string' ? req.query.exerciseId : undefined;

    const result = sessionService.listHistory({ limit, offset, status, startDate, endDate, exerciseId });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = sessionService.getSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/start
router.post('/start', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = StartSessionSchema.parse(req.body);
    const session = sessionService.startSession(validated);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

// PUT /api/sessions/:id/notes
router.put('/:id/notes', (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = typeof req.body.notes === 'string' ? req.body.notes : null;
    const session = sessionService.updateSessionNotes(req.params.id, notes);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/finish
router.post('/:id/finish', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = FinishSessionSchema.parse(req.body);
    const session = sessionService.finishSession(req.params.id, validated.notes);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/cancel
router.post('/:id/cancel', (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = typeof req.body.notes === 'string' ? req.body.notes : null;
    const session = sessionService.cancelSession(req.params.id, notes);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// PUT /api/sessions/:id (Correct past session details)
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = sessionService.updateHistoricalSession(req.params.id, req.body);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    sessionService.deleteSession(req.params.id);
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/sessions/sets/:setId (Save set result immediately)
router.put('/sets/:setId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateSetSchema.parse(req.body);
    const setLog = sessionService.updateSet(req.params.setId, validated);
    res.json(setLog);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/sets/extra (Add extra set to session exercise)
router.post('/sets/extra', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = AddExtraSetSchema.parse(req.body);
    const newSet = sessionService.addExtraSet(validated);
    res.status(201).json(newSet);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/add-exercise (Add an exercise mid-workout)
router.post('/:id/add-exercise', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = AddSessionExerciseSchema.parse(req.body);
    const newExercise = sessionService.addExerciseToSession(req.params.id, validated);
    res.status(201).json(newExercise);
  } catch (error) {
    next(error);
  }
});

export default router;
