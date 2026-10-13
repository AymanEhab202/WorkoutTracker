import { randomUUID, randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb, runInTransaction } from '../db/connection';
import { UserProfile } from '@shared/types';

const SESSION_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const authService = {
  hasOwner(): boolean {
    const db = getDb();
    const row = db.prepare('SELECT count(*) as count FROM app_user').get() as { count: number };
    return row.count > 0;
  },

  getOwner(): UserProfile | null {
    const db = getDb();
    const row = db.prepare('SELECT id, username, created_at FROM app_user LIMIT 1').get() as UserProfile | undefined;
    return row || null;
  },

  async createOwner(username: string, passwordPlain: string): Promise<UserProfile> {
    if (this.hasOwner()) {
      throw new Error('Owner account already configured');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const id = randomUUID();
    const now = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      INSERT INTO app_user (id, username, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, passwordHash, now, now);

    return { id, username, created_at: now };
  },

  async verifyOwner(username: string, passwordPlain: string): Promise<UserProfile | null> {
    const db = getDb();
    const user = db.prepare('SELECT id, username, password_hash, created_at FROM app_user WHERE username = ?').get(username) as {
      id: string;
      username: string;
      password_hash: string;
      created_at: string;
    } | undefined;

    if (!user) return null;

    const matches = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!matches) return null;

    return {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
    };
  },

  createSession(userId: string): { token: string; expiresAt: Date } {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const id = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
    const now = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, tokenHash, expiresAt.toISOString(), now);

    return { token: rawToken, expiresAt };
  },

  validateSession(token: string): UserProfile | null {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();

    const db = getDb();
    const row = db.prepare(`
      SELECT u.id, u.username, u.created_at, s.expires_at
      FROM auth_sessions s
      JOIN app_user u ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(tokenHash, now) as { id: string; username: string; created_at: string; expires_at: string } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      created_at: row.created_at,
    };
  },

  deleteSession(token: string): void {
    if (!token) return;
    const tokenHash = hashToken(token);
    const db = getDb();
    db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  },

  async changePassword(userId: string, currentPasswordPlain: string, newPasswordPlain: string): Promise<boolean> {
    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM app_user WHERE id = ?').get(userId) as { password_hash: string } | undefined;
    if (!user) return false;

    const matches = await bcrypt.compare(currentPasswordPlain, user.password_hash);
    if (!matches) {
      throw new Error('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPasswordPlain, salt);
    const now = new Date().toISOString();

    runInTransaction(() => {
      db.prepare('UPDATE app_user SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, userId);
      // Invalidate all sessions except possibly current
      db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
    });

    return true;
  },
};
