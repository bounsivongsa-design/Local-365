import { existsSync, readFileSync } from "node:fs";
import Database from "@replit/database";

type ReplitResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } };

const REPLIT_DB_FILE = "/tmp/replitdb";

/**
 * Replit's Database client throws at construct time when neither
 * REPLIT_DB_URL nor /tmp/replitdb is set. GitHub Actions and local
 * `npm test` have neither — importing routes.ts used to crash the file.
 *
 * Use the real client when the official lookup would succeed; otherwise
 * an in-memory stub with the same get/set/delete shape.
 */
function hasReplitDbUrl(): boolean {
  if (process.env.REPLIT_DB_URL) return true;
  try {
    if (!existsSync(REPLIT_DB_FILE)) return false;
    return Boolean(readFileSync(REPLIT_DB_FILE, "utf8").trim());
  } catch {
    return false;
  }
}

class MemoryReplitDb {
  private store = new Map<string, unknown>();

  async get(key: string): Promise<ReplitResult<unknown>> {
    if (!this.store.has(key)) return { ok: true, value: null };
    return { ok: true, value: this.store.get(key) };
  }

  async set(key: string, value: unknown): Promise<ReplitResult<this>> {
    this.store.set(key, value);
    return { ok: true, value: this };
  }

  async delete(key: string): Promise<ReplitResult<this>> {
    this.store.delete(key);
    return { ok: true, value: this };
  }
}

const db = hasReplitDbUrl() ? new Database() : new MemoryReplitDb();

export default db;
