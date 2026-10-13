import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { initDb, closeDb } from '../db/connection';
import { runMigrations } from '../db/migrations';
import path from 'path';
import fs from 'fs';

describe('API Integration Tests', () => {
  let testDbFile: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    testDbFile = path.resolve(process.cwd(), `test_api_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    closeDb();
    const db = initDb(testDbFile);
    runMigrations(db);
    app = createApp();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbFile)) {
      try {
        fs.unlinkSync(testDbFile);
      } catch {}
    }
  });

  it('rejects unauthenticated requests to protected endpoints before and after setup', async () => {
    // Before owner setup, returns 403 setup_required
    const resBefore = await request(app).get('/api/exercises');
    expect(resBefore.status).toBe(403);
    expect(resBefore.body.setup_required).toBe(true);

    // Setup owner
    await request(app)
      .post('/api/auth/setup')
      .send({ username: 'gymmaster', password: 'password123' })
      .expect(201);

    // After setup, unauthenticated request returns 401
    const resAfter = await request(app).get('/api/exercises');
    expect(resAfter.status).toBe(401);
    expect(resAfter.body.error).toBe('Authentication required');
  });

  it('completes owner setup, logs in, sets session cookie, and allows protected access', async () => {
    // 1. Initial status check
    const statusRes1 = await request(app).get('/api/auth/status');
    expect(statusRes1.body.isConfigured).toBe(false);
    expect(statusRes1.body.isAuthenticated).toBe(false);

    // 2. Setup owner
    const setupRes = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'gymmaster', password: 'password123' });
    expect(setupRes.status).toBe(201);
    const cookies = setupRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // 3. Status check with cookie
    const statusRes2 = await request(app)
      .get('/api/auth/status')
      .set('Cookie', cookies);
    expect(statusRes2.body.isConfigured).toBe(true);
    expect(statusRes2.body.isAuthenticated).toBe(true);
    expect(statusRes2.body.user.username).toBe('gymmaster');

    // 4. Access exercises with cookie
    const exRes = await request(app)
      .get('/api/exercises')
      .set('Cookie', cookies);
    expect(exRes.status).toBe(200);
    expect(Array.isArray(exRes.body)).toBe(true);

    // 5. Start a session
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Cookie', cookies)
      .send({ name: 'Chest Day API' });
    expect(startRes.status).toBe(201);
    expect(startRes.body.template_name_snapshot).toBe('Chest Day API');

    // 6. Access dashboard
    const dashRes = await request(app)
      .get('/api/dashboard')
      .set('Cookie', cookies);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.today_workout.active_session.id).toBe(startRes.body.id);
  });
});
