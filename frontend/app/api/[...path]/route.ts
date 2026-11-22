import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dbPath() {
  if (process.env.CAMPUSSOLVE_DATABASE) return process.env.CAMPUSSOLVE_DATABASE;
  const source = path.join(process.cwd(), "api", "data", "campussolve.db");
  if (process.platform !== "win32") {
    const target = "/tmp/campussolve.db";
    if (!fs.existsSync(target) && fs.existsSync(source)) fs.copyFileSync(source, target);
    return fs.existsSync(target) ? target : source;
  }
  return fs.existsSync(source) ? source : path.join(process.cwd(), "campussolve.db");
}

function openDb() {
  const db = new DatabaseSync(dbPath());
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      theme TEXT DEFAULT 'emerald_black',
      reset_code TEXT,
      reset_code_expires TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'Pending',
      progress INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      theme TEXT DEFAULT 'emerald_black',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  return db;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${salt}$${digest}`;
}

function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2_sha256") return false;
  const actual = crypto.pbkdf2Sync(password, parts[1], 210000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(parts[2], "hex"));
}

function makeToken(userId: number) {
  const secret = process.env.CAMPUSSOLVE_SESSION_SECRET || "local-development-only-change-in-production";
  const payload = `${userId}.${crypto.randomBytes(12).toString("base64url")}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function currentUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const secret = process.env.CAMPUSSOLVE_SESSION_SECRET || "local-development-only-change-in-production";
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const userId = Number(payload.split(".")[0]);
  if (!Number.isInteger(userId)) return null;
  const db = openDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown> | undefined;
  db.close();
  return user || null;
}

async function body(request: NextRequest) {
  try { return await request.json(); } catch { return {}; }
}

async function handle(request: NextRequest, segments: string[]) {
  const route = segments.join("/");
  const method = request.method;

  if (route === "health" && method === "GET") return json({ ok: true });

  if (route === "auth/register" && method === "POST") {
    const data = await body(request) as Record<string, string>;
    if (!data.full_name?.trim() || !data.username?.trim() || !data.email?.trim()) {
      return json({ detail: "Full name, username, and email are required" }, 400);
    }
    if (!data.email.includes("@")) return json({ detail: "Enter a valid email" }, 400);
    if (!data.password || data.password.length < 8) return json({ detail: "Password must contain at least 8 characters" }, 400);
    if (data.password !== data.confirm) return json({ detail: "Passwords do not match" }, 400);
    const db = openDb();
    const duplicate = db.prepare("SELECT id FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)")
      .get(data.username.trim(), data.email.trim());
    if (duplicate) { db.close(); return json({ detail: "An account with that username or email already exists" }, 409); }
    const result = db.prepare("INSERT INTO users(full_name,username,email,password_hash,theme) VALUES(?,?,?,?,?)")
      .run(data.full_name.trim(), data.username.trim(), data.email.trim().toLowerCase(), hashPassword(data.password), "emerald_black");
    const userId = Number(result.lastInsertRowid);
    db.prepare("INSERT OR REPLACE INTO user_preferences(user_id,theme) VALUES(?,?)").run(userId, "emerald_black");
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId) as Record<string, unknown>;
    db.close();
    return json({ token: makeToken(userId), user });
  }

  if (route === "auth/login" && method === "POST") {
    const data = await body(request) as Record<string, string>;
    const db = openDb();
    const user = db.prepare("SELECT * FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)")
      .get(data.identifier?.trim(), data.identifier?.trim()) as Record<string, unknown> | undefined;
    db.close();
    if (!user || !verifyPassword(data.password || "", String(user.password_hash))) {
      return json({ detail: "Invalid credentials" }, 401);
    }
    return json({ token: makeToken(Number(user.id)), user });
  }

  if (route === "auth/forgot" && method === "POST") {
    const data = await body(request) as Record<string, string>;
    return json({ ok: true, message: "If the email exists, reset instructions are available." });
  }

  const user = currentUser(request);
  if (!user) return json({ detail: "Authentication required" }, 401);

  if (route === "me" && method === "GET") return json(user);

  if (route === "dashboard" && method === "GET") {
    const db = openDb();
    const rows = db.prepare("SELECT * FROM tasks WHERE user_id=?").all(Number(user.id)) as Record<string, unknown>[];
    db.close();
    const today = new Date().toISOString().slice(0, 10);
    const total = rows.length;
    const completed = rows.filter(row => row.status === "Completed").length;
    const pending = rows.filter(row => row.status === "Pending" || row.status === "In Progress").length;
    const overdue = rows.filter(row => row.status === "Overdue").length;
    const todayCount = rows.filter(row => row.due_date === today).length;
    return json({ total, completed, pending, overdue, today: todayCount, completion: total ? Math.round(completed / total * 100) : 0, tasks: rows });
  }

  if (route === "tasks" && method === "GET") {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").toLowerCase();
    const category = url.searchParams.get("category") || "All";
    const priority = url.searchParams.get("priority") || "All";
    const status = url.searchParams.get("status") || "All";
    const sort = url.searchParams.get("sort") || "Newest";
    const db = openDb();
    const clauses = ["user_id=?"];
    const params: unknown[] = [Number(user.id)];
    if (search) { clauses.push("(lower(title) LIKE ? OR lower(description) LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (category !== "All") { clauses.push("category=?"); params.push(category); }
    if (priority !== "All") { clauses.push("priority=?"); params.push(priority); }
    if (status !== "All") { clauses.push("status=?"); params.push(status); }
    const order: Record<string,string> = { Newest:"created_at DESC", Oldest:"created_at ASC", "Due date":"due_date ASC", Priority:"CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END", Title:"title COLLATE NOCASE ASC" };
    const rows = db.prepare(`SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY ${order[sort] || "created_at DESC"}`).all(...params);
    db.close();
    return json(rows);
  }

  if (route === "tasks" && method === "POST") {
    const data = await body(request) as Record<string, unknown>;
    if (!String(data.title || "").trim()) return json({ detail: "Title is required" }, 400);
    const db = openDb();
    const progress = data.status === "Completed" ? 100 : Math.max(0, Math.min(100, Number(data.progress || 0)));
    const result = db.prepare(`INSERT INTO tasks(user_id,title,description,category,priority,due_date,status,progress,completed_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .run(Number(user.id), String(data.title).trim(), String(data.description || ""), String(data.category || "Other"), String(data.priority || "Medium"), String(data.due_date || "") || null, String(data.status || "Pending"), progress, data.status === "Completed" ? new Date().toISOString() : null);
    db.prepare("INSERT INTO notifications(user_id,title,message) VALUES(?,?,?)").run(Number(user.id), "Task created", `"${String(data.title).trim()}" was added to My Tasks.`);
    const task = db.prepare("SELECT * FROM tasks WHERE id=?").get(result.lastInsertRowid);
    db.close();
    return json(task, 201);
  }

  if (route.startsWith("tasks/") && method === "PUT") {
    const taskId = Number(route.split("/")[1]);
    const data = await body(request) as Record<string, unknown>;
    const db = openDb();
    const existing = db.prepare("SELECT id FROM tasks WHERE id=? AND user_id=?").get(taskId, Number(user.id));
    if (!existing) { db.close(); return json({ detail: "Task not found" }, 404); }
    const progress = data.status === "Completed" ? 100 : Math.max(0, Math.min(100, Number(data.progress || 0)));
    db.prepare(`UPDATE tasks SET title=?,description=?,category=?,priority=?,due_date=?,status=?,progress=?,
      completed_at=CASE WHEN ?='Completed' THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE NULL END,
      updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`)
      .run(String(data.title).trim(), String(data.description || ""), String(data.category || "Other"), String(data.priority || "Medium"), String(data.due_date || "") || null, String(data.status || "Pending"), progress, String(data.status || "Pending"), taskId, Number(user.id));
    const task = db.prepare("SELECT * FROM tasks WHERE id=?").get(taskId);
    db.close();
    return json(task);
  }

  if (route.startsWith("tasks/") && method === "DELETE") {
    const taskId = Number(route.split("/")[1]);
    const db = openDb();
    const result = db.prepare("DELETE FROM tasks WHERE id=? AND user_id=?").run(taskId, Number(user.id));
    db.close();
    if (result.changes === 0) return json({ detail: "Task not found" }, 404);
    return json({ ok: true });
  }

  if (route === "notifications" && method === "GET") {
    const db = openDb();
    const rows = db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC").all(Number(user.id));
    db.close();
    return json(rows);
  }

  if (route === "profile" && method === "PUT") {
    const data = await body(request) as Record<string, string>;
    const db = openDb();
    const duplicate = db.prepare("SELECT id FROM users WHERE (lower(username)=lower(?) OR lower(email)=lower(?)) AND id!=?")
      .get(data.username?.trim(), data.email?.trim(), Number(user.id));
    if (duplicate) { db.close(); return json({ detail: "Username or email is already in use" }, 409); }
    db.prepare("UPDATE users SET full_name=?,username=?,email=? WHERE id=?").run(data.full_name?.trim(), data.username?.trim(), data.email?.trim().toLowerCase(), Number(user.id));
    const updated = db.prepare("SELECT * FROM users WHERE id=?").get(Number(user.id));
    db.close();
    return json(updated);
  }

  if (route === "settings/theme" && method === "PUT") {
    const data = await body(request) as Record<string, string>;
    const db = openDb();
    db.prepare("UPDATE users SET theme=? WHERE id=?").run(data.theme, Number(user.id));
    db.prepare("INSERT OR REPLACE INTO user_preferences(user_id,theme,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)").run(Number(user.id), data.theme);
    db.close();
    return json({ ok: true, theme: data.theme });
  }

  if (route === "reports/csv" && method === "GET") {
    const db = openDb();
    const rows = db.prepare("SELECT id,title,description,category,priority,due_date,status,progress,created_at,completed_at FROM tasks WHERE user_id=? ORDER BY created_at DESC").all(Number(user.id)) as Record<string, unknown>[];
    db.close();
    const fields = ["id","title","description","category","priority","due_date","status","progress","created_at","completed_at"];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;
    const csv = [fields.join(","), ...rows.map(row => fields.map(field => escape(row[field])).join(","))].join("\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=campussolve_tasks.csv" } });
  }

  if (route === "reports/json" && method === "GET") {
    const db = openDb();
    const rows = db.prepare("SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC").all(Number(user.id));
    db.close();
    return new NextResponse(JSON.stringify(rows), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=campussolve_tasks.json" } });
  }

  return json({ detail: "API endpoint not found" }, 404);
}

type Params = { params: { path: string[] } };

export async function GET(request: NextRequest, context: Params) { return handle(request, context.params.path || []); }
export async function POST(request: NextRequest, context: Params) { return handle(request, context.params.path || []); }
export async function PUT(request: NextRequest, context: Params) { return handle(request, context.params.path || []); }
export async function DELETE(request: NextRequest, context: Params) { return handle(request, context.params.path || []); }
export async function OPTIONS() {
  return new NextResponse(null, { headers: { "Allow": "GET,POST,PUT,DELETE,OPTIONS", "Content-Type": "application/json" } });
}
