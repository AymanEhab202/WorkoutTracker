import { Router, Request, Response, NextFunction } from 'express';
import { backupService } from '../services/backupService';

const router = Router();

// POST /api/backup/sqlite
router.post('/sqlite', (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = backupService.createSqliteBackup();
    res.status(201).json({
      message: 'SQLite database backup created successfully',
      backup,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/backup/list
router.get('/list', (req: Request, res: Response, next: NextFunction) => {
  try {
    const backups = backupService.listBackups();
    res.json(backups);
  } catch (error) {
    next(error);
  }
});

// GET /api/backup/export (JSON download/export)
router.get('/export', (req: Request, res: Response, next: NextFunction) => {
  try {
    const exportData = backupService.exportJson();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=workout_tracker_export_${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

// POST /api/backup/restore (JSON import/restore)
router.post('/restore', (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = backupService.restoreJson(req.body);
    res.json({
      message: 'Backup restored successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/backup/integrity
router.get('/integrity', (req: Request, res: Response, next: NextFunction) => {
  try {
    const isOk = backupService.checkIntegrity();
    res.json({
      status: isOk ? 'ok' : 'corrupted',
      integrity_check: isOk,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
