import { describe, expect, it } from "vitest";
import { app } from "./app";

class MemoryStatement {
  private params: unknown[] = [];
  constructor(private db: MemoryDb, private sql: string) {}
  bind(...params: unknown[]) { this.params = params; return this; }
  async first<T>() { return this.db.first(this.sql, this.params) as T | null; }
  async all<T>() { return { results: this.db.all(this.sql) as T[] }; }
  async run() { return this.db.run(this.sql, this.params); }
}

class MemoryDb {
  bookmarks: Record<string, unknown>[] = [];
  prepare(sql: string) { return new MemoryStatement(this, sql); }
  first(sql: string, params: unknown[]) {
    if (sql.includes("COUNT(*)")) return { count: this.bookmarks.filter((item) => item.visibility === "public" && !item.deleted_at).length };
    if (sql.includes("WHERE id = ?")) return this.bookmarks.find((item) => item.id === params[0]) ?? null;
    return null;
  }
  all(sql: string) {
    if (sql.includes("FROM agy_bookmarks")) return this.bookmarks.filter((item) => !item.deleted_at && (!sql.includes("visibility = 'public'") || item.visibility === "public"));
    return [];
  }
  run(sql: string, params: unknown[]) {
    if (sql.startsWith("INSERT INTO agy_bookmarks")) {
      const [id, title, url, description, category, tags, visibility, accent, createdAt] = params;
      this.bookmarks.push({ id, title, url, description, category, tags, visibility, accent, is_favorite: 0, is_pinned: 0, click_count: 0, created_at: createdAt, updated_at: createdAt, deleted_at: null });
      return { success: true };
    }
    if (sql.startsWith("UPDATE agy_bookmarks SET deleted_at")) {
      const item = this.bookmarks.find((bookmark) => bookmark.id === params[1]);
      if (item) item.deleted_at = params[0];
      return { success: true };
    }
    return { success: true };
  }
}

const env = (db = new MemoryDb()) => ({ DB: db, ADMIN_PASSWORD_HASH: "unused", SESSION_SECRET: "test-only-session-key", TEST_MODE: "true" });

describe("public collection API", () => {
  it("returns only public bookmarks to anonymous visitors", async () => {
    const db = new MemoryDb();
    db.bookmarks.push(
      { id: "public", title: "Public", url: "https://example.com", visibility: "public", deleted_at: null },
      { id: "private", title: "Private", url: "https://secret.test", visibility: "private", deleted_at: null },
    );
    const response = await app.request("/api/bookmarks", {}, env(db) as never);
    const body = await response.json() as { items: { id: string }[] };
    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.id)).toEqual(["public"]);
  });
});

describe("protected bookmark API", () => {
  it("rejects mutation without an authenticated session", async () => {
    const response = await app.request("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "A", url: "https://a.test" }) }, env() as never);
    expect(response.status).toBe(401);
  });

  it("rejects unsafe bookmark protocols", async () => {
    const response = await app.request("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json", "x-test-auth": "yes" }, body: JSON.stringify({ title: "Bad", url: "javascript:alert(1)" }) }, env() as never);
    expect(response.status).toBe(400);
  });

  it("creates a valid bookmark for an authenticated administrator", async () => {
    const db = new MemoryDb();
    const response = await app.request("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json", "x-test-auth": "yes" }, body: JSON.stringify({ title: "Nous", url: "https://nousresearch.com", visibility: "private", tags: ["AI"] }) }, env(db) as never);
    expect(response.status).toBe(201);
    expect(db.bookmarks[0]).toMatchObject({ title: "Nous", visibility: "private" });
  });
});
