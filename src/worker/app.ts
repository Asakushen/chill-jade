import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createSessionToken, verifyPassword, verifySessionToken } from "./auth";

export type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  API_KEY_HASH: string;
  TEST_MODE?: string;
};

type Variables = { authenticated: boolean; apiKeyAuth: boolean };
type BookmarkInput = {
  title?: string;
  url?: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: "public" | "private";
  accent?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const jsonHeaders = { "Cache-Control": "no-cache, no-store, must-revalidate" };

function validHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

app.use("/api/*", async (context, next) => {
  context.header("Cache-Control", jsonHeaders["Cache-Control"]);
  const testAuth = context.env.TEST_MODE === "true" && context.req.header("x-test-auth") === "yes";
  const token = getCookie(context, "agy_session");
  const session = token ? await verifySessionToken(token, context.env.SESSION_SECRET) : null;
  // API key authentication (Bearer token for programmatic access)
  const authHeader = context.req.header("Authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let apiKeyValid = false;
  if (apiKey && context.env.API_KEY_HASH) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
    const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    apiKeyValid = hex === context.env.API_KEY_HASH;
  }
  context.set("authenticated", testAuth || Boolean(session) || apiKeyValid);
  context.set("apiKeyAuth", apiKeyValid);
  await next();
});

app.get("/api/health", (context) => context.json({ ok: true, service: "浅草玉简" }));

app.get("/api/session", (context) => context.json({ authenticated: context.get("authenticated") }));

app.post("/api/auth/login", async (context) => {
  const body: { password?: string } = await context.req.json<{ password?: string }>().catch(() => ({}));
  if (!body.password || !(await verifyPassword(body.password, context.env.ADMIN_PASSWORD_HASH))) {
    return context.json({ error: "密码不正确" }, 401);
  }
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const token = await createSessionToken(context.env.SESSION_SECRET, expiresAt);
  setCookie(context, "agy_session", token, { httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return context.json({ ok: true });
});

app.post("/api/auth/logout", (context) => {
  deleteCookie(context, "agy_session", { path: "/", secure: true, sameSite: "Strict" });
  return context.json({ ok: true });
});

app.get("/api/bookmarks", async (context) => {
  const authenticated = context.get("authenticated");
  const search = (context.req.query("q") ?? "").trim();
  const category = (context.req.query("category") ?? "").trim();
  const exactUrl = (context.req.query("url") ?? "").trim();
  let sql = `SELECT id,title,url,description,category,tags,visibility,accent,is_favorite,is_pinned,click_count,created_at,updated_at
             FROM agy_bookmarks WHERE deleted_at IS NULL`;
  const params: string[] = [];
  if (!authenticated) sql += " AND visibility = 'public'";
  if (search) {
    sql += " AND (title LIKE ? OR url LIKE ? OR description LIKE ? OR tags LIKE ?)";
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern, pattern);
  }
  if (exactUrl) {
    sql += " AND url = ? COLLATE NOCASE";
    params.push(exactUrl);
  }
  if (category) { sql += " AND category = ?"; params.push(category); }
  sql += " ORDER BY is_pinned DESC, updated_at DESC";
  const result = await context.env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>();
  const items = result.results.map((item) => ({ ...item, tags: JSON.parse(String(item.tags || "[]")) }));
  return context.json({ items, authenticated });
});

app.get("/api/meta", async (context) => {
  const authenticated = context.get("authenticated");
  const visibilitySql = authenticated ? "" : " AND visibility = 'public'";
  const count = await context.env.DB.prepare(`SELECT COUNT(*) AS count FROM agy_bookmarks WHERE deleted_at IS NULL${visibilitySql}`).first<{ count: number }>();
  const categories = await context.env.DB.prepare(`SELECT category, COUNT(*) AS count FROM agy_bookmarks WHERE deleted_at IS NULL${visibilitySql} AND category <> '' GROUP BY category ORDER BY count DESC`).all();
  return context.json({ count: count?.count ?? 0, categories: categories.results, authenticated });
});

app.post("/api/bookmarks", async (context) => {
  if (!context.get("authenticated")) return context.json({ error: "需要登录" }, 401);
  const body: BookmarkInput = await context.req.json<BookmarkInput>().catch(() => ({}));
  const title = body.title?.trim();
  const url = body.url?.trim();
  if (!title || !url || !validHttpUrl(url)) return context.json({ error: "请填写有效名称和 HTTP(S) 地址" }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean))] : [];
  try {
    await context.env.DB.prepare(`INSERT INTO agy_bookmarks
      (id,title,url,description,category,tags,visibility,accent,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
        id, title, url, body.description?.trim() ?? "", body.category?.trim() ?? "未分类", JSON.stringify(tags),
        body.visibility === "private" ? "private" : "public", body.accent ?? "jade", now, now,
      ).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE constraint failed") && message.includes("url")) {
      return context.json({ error: "该链接已在玉简中", url }, 409);
    }
    console.error("bookmark insert failed", message);
    return context.json({ error: "保存失败，请稍后重试" }, 500);
  }
  return context.json({ id }, 201);
});

app.put("/api/bookmarks/:id", async (context) => {
  if (!context.get("authenticated")) return context.json({ error: "需要登录" }, 401);
  const body: BookmarkInput = await context.req.json<BookmarkInput>().catch(() => ({}));
  const title = body.title?.trim();
  const url = body.url?.trim();
  if (!title || !url || !validHttpUrl(url)) return context.json({ error: "请填写有效名称和 HTTP(S) 地址" }, 400);
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean))] : [];
  await context.env.DB.prepare(`UPDATE agy_bookmarks SET title=?,url=?,description=?,category=?,tags=?,visibility=?,accent=?,updated_at=? WHERE id=? AND deleted_at IS NULL`).bind(
    title, url, body.description?.trim() ?? "", body.category?.trim() ?? "未分类", JSON.stringify(tags),
    body.visibility === "private" ? "private" : "public", body.accent ?? "jade", new Date().toISOString(), context.req.param("id"),
  ).run();
  return context.json({ ok: true });
});

app.delete("/api/bookmarks/:id", async (context) => {
  if (!context.get("authenticated")) return context.json({ error: "需要登录" }, 401);
  await context.env.DB.prepare("UPDATE agy_bookmarks SET deleted_at=?,updated_at=? WHERE id=?").bind(new Date().toISOString(), new Date().toISOString(), context.req.param("id")).run();
  return context.json({ ok: true });
});

app.post("/api/bookmarks/:id/click", async (context) => {
  await context.env.DB.prepare("UPDATE agy_bookmarks SET click_count=click_count+1 WHERE id=? AND visibility='public' AND deleted_at IS NULL").bind(context.req.param("id")).run();
  return context.json({ ok: true });
});

app.get("/api/export", async (context) => {
  if (!context.get("authenticated")) return context.json({ error: "需要登录" }, 401);
  const result = await context.env.DB.prepare("SELECT * FROM agy_bookmarks WHERE deleted_at IS NULL ORDER BY created_at").all();
  context.header("Content-Disposition", `attachment; filename="asakusa-gyokukan-${new Date().toISOString().slice(0, 10)}.json"`);
  return context.json({ version: 1, exportedAt: new Date().toISOString(), bookmarks: result.results });
});

export { app };
