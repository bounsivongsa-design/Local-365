import Database from "@replit/database";

type ReplitResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } };

/**
 * Replit's Database client throws at construct time when REPLIT_DB_URL (or
 * /tmp/replitdb) is missing. GitHub Actions and local `npm test` do not have
 * that URL — importing routes.ts used to crash the whole file.
 *
 * Use the real client when a URL exists; otherwise an in-memory stub with the
 * same get/set/delete shape so tests and non-Replit hosts can boot.
 */
function hasReplitDbUrl(): boolean {
  return Boolean(process.env.REPLIT_DB_URL);
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
