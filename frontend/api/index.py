import hashlib
import hmac
import os
import secrets
import sqlite3
import csv
import io
from fastapi.responses import StreamingResponse
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
_configured_db = os.getenv("CAMPUSSOLVE_DATABASE")
if _configured_db:
    DB_PATH = Path(_configured_db)
else:
    source_db = BASE_DIR / "data" / "campussolve.db"
    DB_PATH = Path("/tmp/campussolve.db") if os.name != "nt" else source_db
    if os.name != "nt" and source_db.exists() and not DB_PATH.exists():
        import shutil
        shutil.copy2(source_db, DB_PATH)
SESSION_SECRET = os.getenv("CAMPUSSOLVE_SESSION_SECRET", "local-development-only-change-in-production")


def connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, avatar_url TEXT,
          theme TEXT DEFAULT 'emerald_black', reset_code TEXT, reset_code_expires TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL,
          description TEXT DEFAULT '', category TEXT NOT NULL, priority TEXT NOT NULL,
          due_date TEXT, status TEXT DEFAULT 'Pending', progress INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL,
          message TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id INTEGER PRIMARY KEY, theme TEXT DEFAULT 'emerald_black',
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 210_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 210_000).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, AttributeError):
        return False


def make_token(user_id: int) -> str:
    nonce = secrets.token_urlsafe(12)
    payload = f"{user_id}.{nonce}"
    signature = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization.split(" ", 1)[1]
    try:
        payload, signature = token.rsplit(".", 1)
        expected = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(401, "Invalid session")
        user_id = int(payload.split(".", 1)[0])
    except (ValueError, TypeError):
        raise HTTPException(401, "Invalid session")
    with connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(401, "User not found")
    return dict(user)


class RegisterRequest(BaseModel):
    full_name: str
    username: str
    email: str
    password: str
    confirm: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


class TaskRequest(BaseModel):
    title: str
    description: str = ""
    category: str = "Other"
    priority: str = "Medium"
    due_date: Optional[str] = None
    status: str = "Pending"
    progress: int = 0


app = FastAPI(title="CampusSolve API")


@app.middleware("http")
async def mount_api_prefix(request, call_next):
    if request.scope["path"].startswith("/api"):
        request.scope["path"] = request.scope["path"][4:] or "/"
        request.scope["root_path"] = "/api"
    return await call_next(request)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", os.getenv("FRONTEND_URL", "")],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
init_db()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/auth/register")
def register(request: RegisterRequest):
    if len(request.password) < 8:
        raise HTTPException(400, "Password must contain at least 8 characters")
    if request.password != request.confirm:
        raise HTTPException(400, "Passwords do not match")
    if "@" not in request.email:
        raise HTTPException(400, "Enter a valid email")
    with connection() as conn:
        duplicate = conn.execute(
            "SELECT id FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)",
            (request.username.strip(), request.email.strip()),
        ).fetchone()
        if duplicate:
            raise HTTPException(409, "An account with that username or email already exists")
        cursor = conn.execute(
            "INSERT INTO users(full_name,username,email,password_hash,theme) VALUES(?,?,?,?,?)",
            (request.full_name.strip(), request.username.strip(), request.email.strip().lower(),
             hash_password(request.password), "emerald_black"),
        )
        user_id = cursor.lastrowid
        conn.execute("INSERT OR REPLACE INTO user_preferences(user_id,theme) VALUES(?,?)",
                     (user_id, "emerald_black"))
        user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return {"token": make_token(user_id), "user": dict(user)}


@app.post("/auth/login")
def login(request: LoginRequest):
    with connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)",
            (request.identifier.strip(), request.identifier.strip()),
        ).fetchone()
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": make_token(user["id"]), "user": dict(user)}


@app.get("/me")
def me(user=Depends(current_user)):
    return user


@app.get("/dashboard")
def dashboard(user=Depends(current_user)):
    user_id = user["id"]
    with connection() as conn:
        rows = conn.execute("SELECT * FROM tasks WHERE user_id=?",(user_id,)).fetchall()
    tasks = [dict(row) for row in rows]
    today = date.today().isoformat()
    total = len(tasks)
    completed = sum(task["status"] == "Completed" for task in tasks)
    pending = sum(task["status"] in ("Pending", "In Progress") for task in tasks)
    overdue = sum(task["status"] == "Overdue" for task in tasks)
    today_count = sum(task["due_date"] == today for task in tasks)
    return {
        "total": total, "completed": completed, "pending": pending,
        "overdue": overdue, "today": today_count,
        "completion": round(completed / total * 100) if total else 0,
        "tasks": tasks,
    }


@app.get("/tasks")
def list_tasks(search: str = "", category: str = "All", priority: str = "All",
               status: str = "All", sort: str = "Newest", user=Depends(current_user)):
    clauses = ["user_id=?"]; params = [user["id"]]
    if search:
        clauses.append("(lower(title) LIKE ? OR lower(description) LIKE ?)")
        params += [f"%{search.lower()}%", f"%{search.lower()}%"]
    if category != "All": clauses.append("category=?"); params.append(category)
    if priority != "All": clauses.append("priority=?"); params.append(priority)
    if status != "All": clauses.append("status=?"); params.append(status)
    order = {"Newest":"created_at DESC","Oldest":"created_at ASC","Due date":"due_date ASC",
             "Priority":"CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END",
             "Title":"title COLLATE NOCASE ASC"}[sort]
    with connection() as conn:
        rows = conn.execute(f"SELECT * FROM tasks WHERE {' AND '.join(clauses)} ORDER BY {order}", params).fetchall()
    return [dict(row) for row in rows]


@app.post("/tasks")
def create_task(request: TaskRequest, user=Depends(current_user)):
    if not request.title.strip():
        raise HTTPException(400, "Title is required")
    progress = max(0, min(100, request.progress))
    if request.status == "Completed": progress = 100
    with connection() as conn:
        cursor = conn.execute("""
          INSERT INTO tasks(user_id,title,description,category,priority,due_date,status,progress,completed_at)
          VALUES(?,?,?,?,?,?,?,?,?)
        """, (user["id"],request.title.strip(),request.description.strip(),request.category,
              request.priority,request.due_date or None,request.status,progress,
              datetime.now().isoformat(timespec="seconds") if request.status=="Completed" else None))
        conn.execute("INSERT INTO notifications(user_id,title,message) VALUES(?,?,?)",
                     (user["id"],"Task created",f'"{request.title.strip()}" was added to My Tasks.'))
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (cursor.lastrowid,)).fetchone()
    return dict(task)


@app.put("/tasks/{task_id}")
def update_task(task_id: int, request: TaskRequest, user=Depends(current_user)):
    progress = 100 if request.status == "Completed" else max(0, min(100, request.progress))
    with connection() as conn:
        existing = conn.execute("SELECT id FROM tasks WHERE id=? AND user_id=?",(task_id,user["id"])).fetchone()
        if not existing: raise HTTPException(404,"Task not found")
        conn.execute("""
          UPDATE tasks SET title=?,description=?,category=?,priority=?,due_date=?,status=?,progress=?,
          completed_at=CASE WHEN ?='Completed' THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE NULL END,
          updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?""",
          (request.title.strip(),request.description.strip(),request.category,request.priority,
           request.due_date or None,request.status,progress,request.status,task_id,user["id"]))
        task = conn.execute("SELECT * FROM tasks WHERE id=?",(task_id,)).fetchone()
    return dict(task)


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, user=Depends(current_user)):
    with connection() as conn:
        cursor = conn.execute("DELETE FROM tasks WHERE id=? AND user_id=?",(task_id,user["id"]))
    if not cursor.rowcount: raise HTTPException(404,"Task not found")
    return {"ok": True}


@app.get("/notifications")
def notifications(user=Depends(current_user)):
    with connection() as conn:
        rows = conn.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC",(user["id"],)).fetchall()
    return [dict(row) for row in rows]


class ProfileRequest(BaseModel):
    full_name: str
    username: str
    email: str


class PasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ThemeRequest(BaseModel):
    theme: str


@app.put("/profile")
def update_profile(request: ProfileRequest, user=Depends(current_user)):
    with connection() as conn:
        duplicate = conn.execute(
            "SELECT id FROM users WHERE (lower(username)=lower(?) OR lower(email)=lower(?)) AND id!=?",
            (request.username.strip(), request.email.strip(), user["id"]),
        ).fetchone()
        if duplicate:
            raise HTTPException(409, "Username or email is already in use")
        conn.execute("UPDATE users SET full_name=?,username=?,email=? WHERE id=?",
                     (request.full_name.strip(), request.username.strip(), request.email.strip().lower(), user["id"]))
        updated = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    return dict(updated)


@app.put("/profile/password")
def change_password(request: PasswordRequest, user=Depends(current_user)):
    with connection() as conn:
        stored = conn.execute("SELECT password_hash FROM users WHERE id=?", (user["id"],)).fetchone()
    if not verify_password(request.current_password, stored["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if len(request.new_password) < 8:
        raise HTTPException(400, "New password must contain at least 8 characters")
    with connection() as conn:
        conn.execute("UPDATE users SET password_hash=? WHERE id=?",
                     (hash_password(request.new_password), user["id"]))
    return {"ok": True}


@app.put("/settings/theme")
def update_theme(request: ThemeRequest, user=Depends(current_user)):
    with connection() as conn:
        conn.execute("UPDATE users SET theme=? WHERE id=?", (request.theme, user["id"]))
        conn.execute("""
          INSERT INTO user_preferences(user_id,theme,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET theme=excluded.theme,updated_at=CURRENT_TIMESTAMP
        """, (user["id"], request.theme))
    return {"ok": True, "theme": request.theme}


@app.get("/reports/csv")
def export_csv(user=Depends(current_user)):
    with connection() as conn:
        rows = conn.execute("SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC",(user["id"],)).fetchall()
    output = io.StringIO()
    fieldnames = ["id","title","description","category","priority","due_date","status","progress","created_at","completed_at"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row[field] for field in fieldnames})
    return StreamingResponse(io.BytesIO(output.getvalue().encode("utf-8")),
                             media_type="text/csv",
                             headers={"Content-Disposition":"attachment; filename=campussolve_tasks.csv"})


@app.get("/reports/json")
def export_json(user=Depends(current_user)):
    with connection() as conn:
        rows = conn.execute("SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC",(user["id"],)).fetchall()
    from fastapi.responses import JSONResponse
    return JSONResponse([dict(row) for row in rows],
                        headers={"Content-Disposition":"attachment; filename=campussolve_tasks.json"})


class ResetRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@app.post("/auth/forgot")
def forgot_password(request: ResetRequest):
    code = secrets.token_hex(3).upper()
    expires = (datetime.utcnow() + timedelta(minutes=15)).isoformat(timespec="seconds")
    with connection() as conn:
        user = conn.execute("SELECT id FROM users WHERE lower(email)=lower(?)", (request.email.strip(),)).fetchone()
        if not user:
            return {"ok": True}
        conn.execute("UPDATE users SET reset_code=?,reset_code_expires=? WHERE id=?",
                     (code, expires, user["id"]))
    return {"ok": True, "code": code}


@app.post("/auth/reset")
def reset_password(request: ResetPasswordRequest):
    if len(request.new_password) < 8:
        raise HTTPException(400, "Password must contain at least 8 characters")
    with connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE lower(email)=lower(?)",(request.email.strip(),)).fetchone()
        if not user or user["reset_code"] != request.code.upper():
            raise HTTPException(400, "Invalid reset code")
        if datetime.fromisoformat(user["reset_code_expires"]) < datetime.utcnow():
            raise HTTPException(400, "Reset code has expired")
        conn.execute("UPDATE users SET password_hash=?,reset_code=NULL,reset_code_expires=NULL WHERE id=?",
                     (hash_password(request.new_password), user["id"]))
    return {"ok": True}
