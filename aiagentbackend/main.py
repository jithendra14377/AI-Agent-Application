import asyncio, os, re, shutil, time, uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import mimetypes
import bcrypt, jwt, psycopg

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool
from pydantic import BaseModel
from agent import PLATFORMS, brains, model_options, provider_name, run_agent
from content_types import CONTENT_TYPES

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]
SECRET = os.environ["JWT_SECRET"]
COOKIE = "sf_token"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MANAGER_ROLES = ("super_admin",)  # a super admin can do everything a manager can
START_TIME = time.time()

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, open=False,
                      kwargs={"row_factory": dict_row})


# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     STORAGE_DIR.mkdir(parents=True, exist_ok=True)
#     pool.open(wait=True)
#     yield
#     pool.close()
@asynccontextmanager
async def lifespan(app: FastAPI):
    for sub in ("", "uploads", "brand", "avatars"):
        (STORAGE_DIR / sub).mkdir(parents=True, exist_ok=True)
    print(f"[storage] images, videos and uploads are saved in: {STORAGE_DIR}")
    pool.open(wait=True)
    yield
    pool.close()

app = FastAPI(title="SocialFlow AI API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()
WORKFLOWS: dict[str, dict] = {}   # moves to the database in a later step
RUNS: dict[str, dict] = {}
FAILS: dict[str, list] = defaultdict(list)


class LoginIn(BaseModel):
    email: str
    password: str
    remember: bool = False


class SignupIn(BaseModel):
    name: str
    email: str
    password: str


# ---------------- helpers ----------------
def make_token(kind: str, account_id: int, days: int) -> str:
    prefix = "a" if kind == "admin" else "u"
    return jwt.encode({"sub": f"{prefix}:{account_id}", "exp": int(time.time()) + days * 86400},
                      SECRET, algorithm="HS256")


def get_account(kind: str, account_id: int):
    """Users live in `users`. Super admins live in `superadmins` and get a NEGATIVE id inside the app,
    so an admin can never be mistaken for a user (users always have positive ids)."""
    with pool.connection() as conn:
        if kind == "admin":
            row = conn.execute("SELECT id, name, email FROM superadmins WHERE id = %s AND is_active",
                               (account_id,)).fetchone()
            if not row:
                return None
            return {"id": -row["id"], "name": row["name"], "email": row["email"],
                    "plan": "Super Admin", "role": "super_admin", "kind": "admin"}
        row = conn.execute("SELECT id, name, email, plan, role FROM users WHERE id = %s AND is_active",
                           (account_id,)).fetchone()
    return {**row, "kind": "user"} if row else None


def read_token(token: str):
    try:
        sub = str(jwt.decode(token, SECRET, algorithms=["HS256"])["sub"])
        kind, _, num = sub.partition(":")
        if not num:  # old sessions had no kind: treat them as a normal user
            kind, num = "u", sub
        return get_account("admin" if kind == "a" else "user", int(num))
    except Exception:
        return None


def current_user(request: Request):
    user = read_token(request.cookies.get(COOKIE, ""))
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def require_manager(user=Depends(current_user)):
    if user["role"] not in MANAGER_ROLES:
        raise HTTPException(403, "Only managers can do this.")
    return user


def require_super(user=Depends(current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(403, "Only the super admin can open this.")
    return user

def require_user(user=Depends(current_user)):
    if user["kind"] != "user":
        raise HTTPException(403, "This is only for normal user accounts.")
    return user

def set_login_cookie(response: Response, kind: str, account_id: int, remember: bool):
    days = 30 if remember else 1
    response.set_cookie(
        COOKIE, make_token(kind, account_id, days), httponly=True, samesite="lax",
        secure=False,  # set True when the site runs on HTTPS
        max_age=days * 86400 if remember else None,
    )


def public(u: dict):
    return {"name": u["name"], "email": u["email"], "plan": u["plan"], "role": u["role"]}


def audit(conn, actor_id, action, job_id=None, detail=None):
    """actor_id above 0 is a user. actor_id below 0 is a super admin (their id is -actor_id)."""
    conn.execute(
        "INSERT INTO audit_log (actor_id, actor_admin_id, action, job_id, detail) VALUES (%s,%s,%s,%s,%s)",
        (actor_id if actor_id and actor_id > 0 else None,
         -actor_id if actor_id and actor_id < 0 else None,
         action, job_id, Jsonb(detail) if detail else None),
    )


def check_password(pw: str):
    if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        raise HTTPException(400, "Password must be at least 8 characters with a letter and a number.")
    if len(pw.encode()) > 72:
        raise HTTPException(400, "Password is too long (maximum 72 bytes).")


# ---------------- Auth ----------------
@app.post("/api/auth/signup")
def signup(body: SignupIn, response: Response):
    name = body.name.strip()
    email = body.email.strip().lower()
    pw = body.password

    if not (2 <= len(name) <= 100):
        raise HTTPException(400, "Name must be 2 to 100 characters.")
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(400, "Enter a valid email address.")
    check_password(pw)
    with pool.connection() as conn:
        if conn.execute("SELECT 1 FROM superadmins WHERE email=%s", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists.")

    pw_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    try:
        with pool.connection() as conn:
            user = conn.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) "
                "RETURNING id, name, email, plan, role",
                (name, email, pw_hash),
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "An account with this email already exists.")

    set_login_cookie(response, "user", user["id"], False)
    return {"user": public(user)}


# @app.post("/api/auth/login")
# def login(body: LoginIn, request: Request, response: Response):
#     ip = request.client.host if request.client else "unknown"
#     now = time.time()
#     FAILS[ip] = [t for t in FAILS[ip] if now - t < 60]
#     if len(FAILS[ip]) >= 5:
#         raise HTTPException(429, "Too many attempts. Try again in a minute.")

#     email = body.email.strip().lower()
#     with pool.connection() as conn:
#         row = conn.execute(
#             "SELECT id, name, email, plan, role, password_hash FROM users WHERE email = %s AND is_active",
#             (email,),
#         ).fetchone()

#     pw_bytes = body.password.encode()
#     ok = False
#     if len(pw_bytes) <= 72:
#         stored = row["password_hash"] if row else DUMMY_HASH
#         ok = bcrypt.checkpw(pw_bytes, stored.encode())

#     if not (row and ok):
#         FAILS[ip].append(now)
#         raise HTTPException(401, "Incorrect username or password")

#     set_login_cookie(response, row["id"], body.remember)
#     return {"user": public(row)}

@app.post("/api/auth/login")
def login(body: LoginIn, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    FAILS[ip] = [t for t in FAILS[ip] if now - t < 60]
    if len(FAILS[ip]) >= 5:
        raise HTTPException(429, "Too many attempts. Try again in a minute.")

    email = body.email.strip().lower()
    kind = "user"
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT id, name, email, plan, role, password_hash FROM users WHERE email = %s AND is_active",
            (email,),
        ).fetchone()
        if not row:
            row = conn.execute(
                "SELECT id, name, email, password_hash FROM superadmins WHERE email = %s AND is_active",
                (email,),
            ).fetchone()
            kind = "admin"

    pw_bytes = body.password.encode()
    ok = False
    if len(pw_bytes) <= 72:
        stored = row["password_hash"] if row else DUMMY_HASH
        ok = bcrypt.checkpw(pw_bytes, stored.encode())

    if not (row and ok):
        FAILS[ip].append(now)
        raise HTTPException(401, "Incorrect username or password")

    if kind == "admin":
        row = {**row, "plan": "Super Admin", "role": "super_admin"}
        with pool.connection() as conn:
            conn.execute("UPDATE superadmins SET last_login_at = NOW() WHERE id = %s", (row["id"],))
            audit(conn, -row["id"], "admin_login")

    set_login_cookie(response, kind, row["id"], body.remember)
    return {"user": public(row)}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return public(user)

class PasswordIn(BaseModel):
    current: str
    new: str


@app.post("/api/auth/change-password")
def change_password(body: PasswordIn, user=Depends(current_user)):
    key = f"pw:{user['id']}"
    now = time.time()
    FAILS[key] = [t for t in FAILS[key] if now - t < 60]
    if len(FAILS[key]) >= 5:
        raise HTTPException(429, "Too many attempts. Try again in a minute.")
    check_password(body.new)
    table, acct = ("superadmins", -user["id"]) if user["kind"] == "admin" else ("users", user["id"])
    with pool.connection() as conn:
        row = conn.execute(f"SELECT password_hash FROM {table} WHERE id=%s", (acct,)).fetchone()
        cur_bytes = body.current.encode()
        if len(cur_bytes) > 72 or not bcrypt.checkpw(cur_bytes, row["password_hash"].encode()):
            FAILS[key].append(now)
            raise HTTPException(400, "Your current password is incorrect.")
        new_hash = bcrypt.hashpw(body.new.encode(), bcrypt.gensalt()).decode()
        conn.execute(f"UPDATE {table} SET password_hash=%s WHERE id=%s", (new_hash, acct))
        audit(conn, user["id"], "password_changed", None)
    return {"ok": True}
# @app.post("/api/auth/change-password")
# def change_password(body: "PasswordIn", user=Depends(current_user)):
#     key = f"pw:{user['id']}"
#     now = time.time()
#     FAILS[key] = [t for t in FAILS[key] if now - t < 60]
#     if len(FAILS[key]) >= 5:
#         raise HTTPException(429, "Too many attempts. Try again in a minute.")
#     check_password(body.new)
#     with pool.connection() as conn:
#         row = conn.execute("SELECT password_hash FROM users WHERE id=%s", (user["id"],)).fetchone()
#         cur_bytes = body.current.encode()
#         if len(cur_bytes) > 72 or not bcrypt.checkpw(cur_bytes, row["password_hash"].encode()):
#             FAILS[key].append(now)
#             raise HTTPException(400, "Your current password is incorrect.")
#         new_hash = bcrypt.hashpw(body.new.encode(), bcrypt.gensalt()).decode()
#         conn.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, user["id"]))
#         audit(conn, user["id"], "password_changed", None)
#     return {"ok": True}


# ---------------- Dashboard and workflows ----------------
@app.get("/api/dashboard/summary")
def summary(user=Depends(current_user)):
    return {"agents": 5, "runs_today": 128, "success_rate": 98.4, "tokens_used": 412_500}


@app.get("/api/workflows/{wid}")
def get_workflow(wid: str, user=Depends(current_user)):
    return WORKFLOWS.get(f"{user['id']}:{wid}", {"nodes": [], "edges": []})


@app.put("/api/workflows/{wid}")
def save_workflow(wid: str, body: dict, user=Depends(current_user)):
    WORKFLOWS[f"{user['id']}:{wid}"] = {"nodes": body.get("nodes", []), "edges": body.get("edges", [])}
    return {"saved": True}


@app.post("/api/workflows/{wid}/run")
def run_workflow(wid: str, user=Depends(current_user)):
    run_id = uuid.uuid4().hex
    RUNS[run_id] = {"workflow": wid, "owner": user["id"], "status": "running"}
    return {"run_id": run_id}


ORDER = ["ig", "fb", "yt", "li", "x", "hub", "content", "image", "video", "publisher"]


@app.websocket("/ws/runs/{run_id}")
async def run_events(ws: WebSocket, run_id: str):
    user = await asyncio.to_thread(read_token, ws.cookies.get(COOKIE, ""))
    run = RUNS.get(run_id)
    if not user or not run or run["owner"] != user["id"]:
        await ws.close(code=4401)
        return
    await ws.accept()
    try:
        for node in ORDER:
            await ws.send_json({"node": node, "status": "running"})
            await asyncio.sleep(0.6)  # <- real LLM / platform API call goes here
            await ws.send_json({"node": node, "status": "done"})
        run["status"] = "completed"
        await ws.send_json({"type": "finished"})
        await ws.close()
    except WebSocketDisconnect:
        pass


# ---------------- Integrations, activity, health ----------------
def _set(*names):
    return all(os.environ.get(n, "").strip() for n in names)


@app.get("/api/integrations")
def list_integrations(user=Depends(current_user)):
    """What the server is connected to. Only names and statuses are returned, never key values."""
    items = []
    for b in brains():
        name = provider_name(b["url"])
        env = ([f"LLM_{b['idx']}_KEY", f"LLM_{b['idx']}_URL", f"LLM_{b['idx']}_MODEL"] if b["idx"]
               else ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"])
        items.append({"key": f"brain-{b['idx']}", "name": name, "category": "ai", "status": "connected",
                      "description": "AI brain · " + ", ".join(b["models"][:2]), "env": env,
                      "key_label": f"{name} API Key"})
    items.append({"key": "cloudflare", "name": "Cloudflare Workers AI", "category": "ai",
                  "status": "connected" if _set("CF_ACCOUNT_ID", "CF_API_TOKEN") else "not_connected",
                  "description": "Image generation · FLUX.1 schnell", "env": ["CF_ACCOUNT_ID", "CF_API_TOKEN"],
                  "key_label": "Cloudflare API Token"})
    items.append({"key": "magichour", "name": "Magic Hour", "category": "ai",
                  "status": "connected" if _set("MAGIC_HOUR_API_KEY") else "not_connected",
                  "description": "AI video generation", "env": ["MAGIC_HOUR_API_KEY", "VIDEO_MAX_SECONDS"],
                  "key_label": "Magic Hour API Key"})
    items.append({"key": "postgres", "name": "PostgreSQL", "category": "storage", "status": "connected",
                  "description": "Database · users, content and history", "env": ["DATABASE_URL"]})
    items.append({"key": "files", "name": "Server file storage", "category": "storage", "status": "connected",
                  "description": "Images, videos and uploads", "env": []})
    items.append({"key": "ffmpeg", "name": "FFmpeg", "category": "automation",
                  "status": "connected" if (os.environ.get("FFMPEG_PATH") or shutil.which("ffmpeg")) else "not_connected",
                  "description": "Video processing · logo overlay", "env": ["FFMPEG_PATH"]})
    for key, name, desc in [("instagram", "Instagram", "Post, reels, stories, insights"),
                            ("facebook", "Facebook", "Pages, posts, analytics"),
                            ("youtube", "YouTube", "Videos, shorts, community"),
                            ("linkedin", "LinkedIn", "Company pages, posts, analytics"),
                            ("x", "X (Twitter)", "Posts, threads, analytics"),
                            ("tiktok", "TikTok", "Videos, trends, analytics")]:
        items.append({"key": key, "name": name, "category": "social", "status": "not_connected",
                      "description": desc, "env": []})
    for key, name, desc in [("pinterest", "Pinterest", "Pins, boards, analytics"),
                            ("telegram", "Telegram", "Channel posts, automation")]:
        items.append({"key": key, "name": name, "category": "social", "status": "planned",
                      "description": desc, "env": []})
    return items


@app.get("/api/activity")
def recent_activity(user=Depends(current_user)):
    with pool.connection() as conn:
        rows = conn.execute(
            """
            SELECT s.tool_name, s.status, s.created_at, j.id AS job_id,
                   left(COALESCE(j.seo_title, j.instruction), 60) AS title
            FROM job_steps s JOIN content_jobs j ON j.id = s.job_id
            WHERE j.owner_id = %s AND s.tool_name <> 'read_inputs' AND s.status IN ('done', 'failed')
            ORDER BY s.created_at DESC
            LIMIT 12
            """,
            (user["id"],),
        ).fetchall()
    return rows


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/agents/status")
def agents_status(user=Depends(current_user)):
    """Which parts of the agent are ready. Never returns keys, only yes/no and a short note."""
    models = model_options()
    cf_ok = bool(os.environ.get("CF_ACCOUNT_ID") and os.environ.get("CF_API_TOKEN"))
    magic_ok = bool(os.environ.get("MAGIC_HOUR_API_KEY"))
    ffmpeg_ok = bool(os.environ.get("FFMPEG_PATH") or shutil.which("ffmpeg"))
    if magic_ok:
        video = {"ready": True, "detail": "Magic Hour AI video"}
    elif ffmpeg_ok:
        video = {"ready": True, "detail": "Storyboard video (ffmpeg)"}
    else:
        video = {"ready": False, "detail": "No video tool found (ffmpeg or Magic Hour key)"}
    return {
        "content": {"ready": bool(models), "detail": f"{len(models)} AI model{'s' if len(models) != 1 else ''} ready" if models else "No AI model key in .env"},
        "image": {"ready": cf_ok, "detail": "FLUX.1 schnell ready" if cf_ok else "Cloudflare keys missing in .env"},
        "video": video,
        "publisher": {"ready": False, "detail": "Switched off until accounts are connected"},
        "platforms": {p: False for p in PLATFORMS},
    }


# ---------------- Content jobs (AI agent) ----------------
def get_job_or_404(job_id: int, user: dict):
    with pool.connection() as conn:
        job = conn.execute(
            "SELECT id, owner_id, status, instruction, seo_title, description, hashtags, "
            "copy_by_platform, created_at,rejection_reason  FROM content_jobs WHERE id = %s",
            (job_id,),
        ).fetchone()
    if not job or (job["owner_id"] != user["id"] and user["role"] not in MANAGER_ROLES):
        raise HTTPException(404, "Job not found.")
    return job


@app.get("/api/content-types")
def list_content_types(user=Depends(current_user)):
    return [{"key": k, "label": v["label"], "hint": v["hint"]} for k, v in CONTENT_TYPES.items()]


@app.get("/api/models")
def list_models(user=Depends(current_user)):
    return model_options()


ALLOWED_UPLOADS = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".md", ".csv"}
MAX_FILES = 5
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 9 * 1024 * 1024


@app.post("/api/jobs")
async def create_job(
    background: BackgroundTasks,
    instruction: str = Form(...),
    content_type: str = Form("auto"),
    model: str = Form("auto"),
    files: list[UploadFile] | None = File(default=None),
    user=Depends(require_user),
):
    instruction = instruction.strip()
    if not 5 <= len(instruction) <= 4000:
        raise HTTPException(400, "Describe what you want to create (5 to 4000 characters).")
    if content_type not in CONTENT_TYPES:
        raise HTTPException(400, "Unknown content type.")
    if model != "auto" and model not in {o["id"] for o in model_options()}:
        raise HTTPException(400, "That model is not available.")
    files = files or []
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"You can attach up to {MAX_FILES} files.")

    uploads, total = [], 0
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_UPLOADS:
            raise HTTPException(400, "Allowed attachments: images, PDF, TXT, MD and CSV.")
        data = await f.read(MAX_FILE_BYTES + 1)
        total += len(data)
        if len(data) > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
            raise HTTPException(400, "Attachments are too large (9 MB in total).")
        uploads.append((ext, data))

    with pool.connection() as conn:
        recent = conn.execute(
            "SELECT COUNT(*) AS n FROM content_jobs WHERE owner_id=%s AND created_at > NOW() - INTERVAL '1 hour'",
            (user["id"],),
        ).fetchone()["n"]
        if recent >= 10:
            raise HTTPException(429, "Too many jobs this hour. Try again later.")
        job = conn.execute(
            "INSERT INTO content_jobs (owner_id, instruction, brief, status, content_type, model_choice) "
            "VALUES (%s,%s,'','generating',%s,%s) RETURNING id",
            (user["id"], instruction, content_type, model),
        ).fetchone()
        audit(conn, user["id"], "job_created", job["id"])

    if uploads:
        folder = STORAGE_DIR / "uploads" / f"job_{job['id']}"
        folder.mkdir(parents=True, exist_ok=True)
        for i, (ext, data) in enumerate(uploads, 1):
            (folder / f"attachment_{i}{ext}").write_bytes(data)

    background.add_task(run_agent, pool, job["id"])
    return {"id": job["id"]}


@app.get("/api/jobs")
def list_jobs(user=Depends(current_user)):
    with pool.connection() as conn:
        rows = conn.execute(
            """
            SELECT j.id, j.status, j.seo_title, left(j.instruction, 100) AS instruction, j.created_at,
                   j.scheduled_at, j.scheduled_platform,
                   (SELECT a.id FROM assets a WHERE a.job_id = j.id AND a.kind = 'image'
                    ORDER BY a.id LIMIT 1) AS thumb,
                   (SELECT COUNT(*) FROM assets a WHERE a.job_id = j.id AND a.kind = 'image') AS images,
                   EXISTS (SELECT 1 FROM assets a WHERE a.job_id = j.id AND a.kind = 'video') AS has_video,
                   COALESCE((SELECT s.output->>'aspect_ratio' FROM job_steps s
                             WHERE s.job_id = j.id AND s.tool_name = 'plan_content' AND s.status = 'done'
                             ORDER BY s.step_no DESC LIMIT 1), '') AS aspect
            FROM content_jobs j
            WHERE j.owner_id = %s
            ORDER BY j.created_at DESC
            LIMIT 200
            """,
            (user["id"],),
        ).fetchall()
        bad = _missing_jobs(conn, [r["id"] for r in rows])
    for r in rows:
        r["missing_files"] = r["id"] in bad
    return rows


@app.get("/api/jobs/{job_id}")
def read_job(job_id: int, user=Depends(current_user)):
    job = get_job_or_404(job_id, user)
    with pool.connection() as conn:
        steps = conn.execute(
            "SELECT id, step_no, tool_name, status, output FROM job_steps WHERE job_id=%s ORDER BY step_no",
            (job_id,),
        ).fetchall()
        raw = conn.execute(
            "SELECT id, kind, storage_path FROM assets WHERE job_id=%s ORDER BY id", (job_id,)
        ).fetchall()
    root = STORAGE_DIR.resolve()
    assets = []
    for a in raw:
        f = (STORAGE_DIR / a["storage_path"]).resolve()
        assets.append({"id": a["id"], "kind": a["kind"], "missing": not (f.is_relative_to(root) and f.is_file())})
    return {**job, "steps": steps, "assets": assets}


# ---------------- Manager approval and calendar actions ----------------
class ScheduleIn(BaseModel):
    scheduled_at: datetime
    platform: str


class RejectIn(BaseModel):
    reason: str = ""


@app.get("/api/approvals")
def approvals(user=Depends(require_manager)):
    """Everything waiting for a manager, from all users, oldest first."""
    with pool.connection() as conn:
        return conn.execute(
            """
            SELECT j.id, j.seo_title, left(j.instruction, 100) AS instruction, j.created_at, u.name AS owner,
                   (SELECT a.id FROM assets a WHERE a.job_id = j.id AND a.kind = 'image'
                    ORDER BY a.id LIMIT 1) AS thumb,
                   EXISTS (SELECT 1 FROM assets a WHERE a.job_id = j.id AND a.kind = 'video') AS has_video
            FROM content_jobs j JOIN users u ON u.id = j.owner_id
            WHERE j.status = 'pending_approval'
            ORDER BY j.created_at
            """
        ).fetchall()


@app.post("/api/jobs/{job_id}/approve")
def approve_job(job_id: int, user=Depends(require_manager)):
    job = get_job_or_404(job_id, user)
    if job["status"] != "pending_approval":
        raise HTTPException(409, "Only content that is waiting for approval can be approved.")
    with pool.connection() as conn:
        conn.execute(
            "UPDATE content_jobs SET status='approved', approved_by_admin=%s, approved_at=NOW(), "
            "rejection_reason=NULL, updated_at=NOW() WHERE id=%s",
            (-user["id"], job_id),
            # "UPDATE content_jobs SET status='approved', approved_by=%s, approved_at=NOW(), "
            # "rejection_reason=NULL, updated_at=NOW() WHERE id=%s",
            # (user["id"], job_id),
        )
        audit(conn, user["id"], "job_approved", job_id)
    return {"ok": True}


@app.post("/api/jobs/{job_id}/reject")
def reject_job(job_id: int, body: RejectIn, user=Depends(require_manager)):
    job = get_job_or_404(job_id, user)
    if job["status"] != "pending_approval":
        raise HTTPException(409, "Only content that is waiting for approval can be rejected.")
    reason = body.reason.strip()[:500]
    with pool.connection() as conn:
        conn.execute(
            "UPDATE content_jobs SET status='rejected', rejection_reason=%s, scheduled_at=NULL, "
            "scheduled_platform=NULL, updated_at=NOW() WHERE id=%s",
            (reason or None, job_id),
        )
        audit(conn, user["id"], "job_rejected", job_id, {"reason": reason})
    return {"ok": True}


@app.post("/api/jobs/{job_id}/submit")
def submit_job(job_id: int, user=Depends(current_user)):
    """Send a draft or rejected item back to the manager."""
    job = get_job_or_404(job_id, user)
    if job["status"] not in ("draft", "rejected"):
        raise HTTPException(409, "Only drafts and rejected items can be sent for approval.")
    with pool.connection() as conn:
        conn.execute(
            "UPDATE content_jobs SET status='pending_approval', rejection_reason=NULL, updated_at=NOW() WHERE id=%s",
            (job_id,),
        )
        audit(conn, user["id"], "job_resubmitted", job_id)
    return {"ok": True}


@app.put("/api/jobs/{job_id}/schedule")
def schedule_job(job_id: int, body: ScheduleIn, user=Depends(current_user)):
    job = get_job_or_404(job_id, user)
    if job["status"] != "approved":
        raise HTTPException(409, "Only approved content can be scheduled. A manager must approve it first.")
    if body.platform not in PLATFORMS:
        raise HTTPException(400, "Unknown platform.")
    if body.scheduled_at.tzinfo is None:
        raise HTTPException(400, "The scheduled time must include a time zone.")
    with pool.connection() as conn:
        conn.execute(
            "UPDATE content_jobs SET scheduled_at=%s, scheduled_platform=%s, updated_at=NOW() WHERE id=%s",
            (body.scheduled_at, body.platform, job_id),
        )
        audit(conn, user["id"], "job_scheduled", job_id,
              {"at": body.scheduled_at.isoformat(), "platform": body.platform})
    return {"ok": True}


@app.post("/api/jobs/{job_id}/draft")
def move_to_draft(job_id: int, user=Depends(current_user)):
    job = get_job_or_404(job_id, user)
    if job["status"] in ("generating", "publishing", "published"):
        raise HTTPException(409, "This item cannot be moved to draft right now.")
    with pool.connection() as conn:
        conn.execute(
            "UPDATE content_jobs SET status='draft', scheduled_at=NULL, scheduled_platform=NULL, "
            "approved_by=NULL, approved_at=NULL, updated_at=NOW() WHERE id=%s",
            (job_id,),
        )
        audit(conn, user["id"], "job_moved_to_draft", job_id)
    return {"ok": True}


@app.post("/api/jobs/{job_id}/duplicate")
def duplicate_job(job_id: int, user=Depends(require_user)):
    old = get_job_or_404(job_id, user)
    if old["status"] == "generating":
        raise HTTPException(409, "Wait for the agent to finish first.")
    with pool.connection() as conn:
        new = conn.execute(
            "INSERT INTO content_jobs (owner_id, instruction, brief, status, seo_title, description, hashtags, "
            "copy_by_platform, content_type, model_choice) "
            "SELECT %s::bigint, instruction, brief, 'draft', seo_title, description, hashtags, "
            "copy_by_platform, content_type, model_choice FROM content_jobs WHERE id=%s RETURNING id",
            (user["id"], job_id),
        ).fetchone()
        assets = conn.execute(
            "SELECT kind, storage_path, provider FROM assets WHERE job_id=%s ORDER BY id", (job_id,)
        ).fetchall()
        root = STORAGE_DIR.resolve()
        folder = STORAGE_DIR / f"job_{new['id']}"
        for a in assets:
            src = (STORAGE_DIR / a["storage_path"]).resolve()
            if not src.is_relative_to(root) or not src.is_file():
                continue
            folder.mkdir(parents=True, exist_ok=True)
            dst = folder / src.name
            shutil.copy2(src, dst)
            conn.execute(
                "INSERT INTO assets (job_id, kind, storage_path, provider) VALUES (%s,%s,%s,%s)",
                (new["id"], a["kind"], str(dst.relative_to(STORAGE_DIR)).replace("\\", "/"), a["provider"]),
            )
        audit(conn, user["id"], "job_duplicated", new["id"], {"from": job_id})
    return {"id": new["id"]}

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, user=Depends(current_user)):
    job = get_job_or_404(job_id, user)
    if job["status"] == "generating":
        raise HTTPException(409, "The agent is still working on this. Wait for it to finish.")
    root = STORAGE_DIR.resolve()
    with pool.connection() as conn:
        paths = [r["storage_path"] for r in conn.execute(
            "SELECT storage_path FROM assets WHERE job_id=%s", (job_id,)).fetchall()]
        audit(conn, user["id"], "job_deleted", None, {"job_id": job_id, "title": job["seo_title"]})
        conn.execute("DELETE FROM content_jobs WHERE id=%s", (job_id,))  # steps, assets and posts go with it

    removed = 0
    for rel in paths:  # every file the database knew about
        p = (STORAGE_DIR / rel).resolve()
        if p.is_relative_to(root) and p.is_file():
            try:
                p.unlink()
                removed += 1
            except OSError:
                pass
    for folder in (STORAGE_DIR / f"job_{job_id}", STORAGE_DIR / "uploads" / f"job_{job_id}"):
        if folder.is_dir():  # anything else left in this content's folders
            removed += sum(1 for f in folder.rglob("*") if f.is_file())
            shutil.rmtree(folder, ignore_errors=True)
    return {"ok": True, "files_removed": removed}
# @app.delete("/api/jobs/{job_id}")
# def delete_job(job_id: int, user=Depends(current_user)):
#     job = get_job_or_404(job_id, user)
#     if job["status"] == "generating":
#         raise HTTPException(409, "The agent is still working on this. Wait for it to finish.")
#     with pool.connection() as conn:
#         audit(conn, user["id"], "job_deleted", None, {"job_id": job_id, "title": job["seo_title"]})
#         conn.execute("DELETE FROM content_jobs WHERE id=%s", (job_id,))
#     shutil.rmtree(STORAGE_DIR / f"job_{job_id}", ignore_errors=True)
#     shutil.rmtree(STORAGE_DIR / "uploads" / f"job_{job_id}", ignore_errors=True)
#     return {"ok": True}

# ---------------- Edit content text ----------------
class JobEdit(BaseModel):
    seo_title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None
    copy_by_platform: dict[str, str] | None = None


EDITABLE_STATUSES = ("draft", "rejected", "pending_approval")


@app.patch("/api/jobs/{job_id}")
def edit_job(job_id: int, body: JobEdit, user=Depends(current_user)):
    job = get_job_or_404(job_id, user)
    if job["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the author can edit this content.")
    if job["status"] not in EDITABLE_STATUSES:
        raise HTTPException(409, "Only drafts, rejected items and items awaiting approval can be edited.")

    title, desc = job["seo_title"], job["description"]
    tags, copy = list(job["hashtags"] or []), dict(job["copy_by_platform"] or {})

    if body.seo_title is not None:
        title = body.seo_title.strip()
        if not 3 <= len(title) <= 200:
            raise HTTPException(400, "The title must be 3 to 200 characters.")
    if body.description is not None:
        desc = body.description.strip()
        if not 1 <= len(desc) <= 5000:
            raise HTTPException(400, "The description must be 1 to 5000 characters.")
    if body.hashtags is not None:
        tags = []
        for h in body.hashtags[:30]:
            h = "#" + "".join(ch for ch in h if ch.isalnum() or ch == "_")
            if len(h) > 1 and h not in tags:
                tags.append(h)
        if not tags:
            raise HTTPException(400, "Add at least one hashtag.")
    if body.copy_by_platform is not None:
        for p, text in body.copy_by_platform.items():
            if p not in PLATFORMS:
                raise HTTPException(400, f"Unknown platform: {p}.")
            text = text.strip()
            if len(text) > 3000:
                raise HTTPException(400, f"The {p} caption is too long (3000 characters maximum).")
            if p == "x" and len(text) > 280:
                raise HTTPException(400, "The X caption must be 280 characters or fewer.")
            copy[p] = text

    with pool.connection() as conn:
        conn.execute(
            "UPDATE content_jobs SET seo_title=%s, description=%s, hashtags=%s, copy_by_platform=%s, "
            "updated_at=NOW() WHERE id=%s",
            (title, desc, tags, Jsonb(copy), job_id),
        )
        audit(conn, user["id"], "job_edited", job_id)
    return {"ok": True}

# ---------------- Assets (images and videos) ----------------
@app.get("/api/assets/{asset_id}/file")
def asset_file(asset_id: int, download: int = 0, user=Depends(current_user)):
    with pool.connection() as conn:
        asset = conn.execute(
            "SELECT a.storage_path, a.kind, j.owner_id FROM assets a "
            "JOIN content_jobs j ON j.id = a.job_id WHERE a.id = %s",
            (asset_id,),
        ).fetchone()

    # same answer for "missing" and "not yours", so nobody can probe which IDs exist
    if not asset or (asset["owner_id"] != user["id"] and user["role"] not in MANAGER_ROLES):
        raise HTTPException(404, "Not found.")

    path = (STORAGE_DIR / asset["storage_path"]).resolve()
    if not path.is_relative_to(STORAGE_DIR.resolve()) or not path.is_file():
        raise HTTPException(404, "Not found.")

    media = "video/mp4" if asset["kind"] == "video" else (mimetypes.guess_type(str(path))[0] or "image/jpeg")
    return FileResponse(path, media_type=media, filename=path.name if download else None)


# ---------------- Settings ----------------
LANG_OPTS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati"]
TZ_OPTS = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London",
           "America/New_York", "America/Los_Angeles", "Australia/Sydney"]
DATE_OPTS = ["MMM DD, YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]
FONT_OPTS = ["Poppins", "Inter", "Montserrat", "Roboto", "Playfair Display"]
AUTO_KEYS = ["auto_publish", "ai_captions", "auto_reschedule", "suggestions"]
WS_DEFAULTS = {
    "workspace_name": "SocialFlow AI", "language": "English", "timezone": "Asia/Kolkata",
    "date_format": "MMM DD, YYYY", "brand_colors": ["#d946ef", "#7c3aed", "#3b82f6"], "brand_font": "Poppins",
    "automation": {"auto_publish": True, "ai_captions": True, "auto_reschedule": True, "suggestions": True},
    "logo": "",
}
USER_DEFAULTS = {"theme": "dark", "notifications": {"email": True, "in_app": True, "marketing": False}}


def get_ws() -> dict:
    with pool.connection() as conn:
        row = conn.execute("SELECT data FROM workspace_settings WHERE id = 1").fetchone()
    data = (row["data"] if row else None) or {}
    return {**WS_DEFAULTS, **data, "automation": {**WS_DEFAULTS["automation"], **(data.get("automation") or {})}}


def save_ws(data: dict, user_id: int):
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO workspace_settings (id, data, updated_by) VALUES (1,%s,%s) "
            "ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_by=EXCLUDED.updated_by, updated_at=NOW()",
            (Jsonb(data), user_id),
        )
        audit(conn, user_id, "workspace_updated", None)

def _user_settings(conn, uid: int) -> dict:
    table, acct = ("superadmins", -uid) if uid < 0 else ("users", uid)
    row = conn.execute(f"SELECT settings FROM {table} WHERE id=%s", (acct,)).fetchone()
    return (row["settings"] if row else None) or {}


def _save_user_settings(conn, uid: int, data: dict):
    table, acct = ("superadmins", -uid) if uid < 0 else ("users", uid)
    conn.execute(f"UPDATE {table} SET settings=%s WHERE id=%s", (Jsonb(data), acct))
# def _user_settings(conn, uid: int) -> dict:
#     row = conn.execute("SELECT settings FROM users WHERE id=%s", (uid,)).fetchone()
#     return (row["settings"] if row else None) or {}


# def _save_user_settings(conn, uid: int, data: dict):
#     conn.execute("UPDATE users SET settings=%s WHERE id=%s", (Jsonb(data), uid))


class WorkspaceIn(BaseModel):
    workspace_name: str | None = None
    language: str | None = None
    timezone: str | None = None
    date_format: str | None = None
    brand_colors: list[str] | None = None
    brand_font: str | None = None
    automation: dict[str, bool] | None = None


class MeIn(BaseModel):
    name: str | None = None
    theme: str | None = None
    notifications: dict[str, bool] | None = None


class PasswordIn(BaseModel):
    current: str
    new: str


class TeamIn(BaseModel):
    name: str
    email: str
    password: str
    role: str = "user"


class TeamUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None


@app.get("/api/settings")
def read_settings(user=Depends(current_user)):
    with pool.connection() as conn:
        mine_raw = _user_settings(conn, user["id"])
    mine = {**USER_DEFAULTS, **mine_raw}
    mine["notifications"] = {**USER_DEFAULTS["notifications"], **(mine.get("notifications") or {})}
    ws = get_ws()
    return {
        "workspace": {k: v for k, v in ws.items() if k != "logo"},
        "has_logo": bool(ws.get("logo")),
        "me": {**public(user), "prefs": mine},
    }


@app.put("/api/settings/workspace")
def update_workspace(body: WorkspaceIn, user=Depends(require_manager)):
    cur = get_ws()
    if body.workspace_name is not None:
        name = body.workspace_name.strip()
        if not 2 <= len(name) <= 100:
            raise HTTPException(400, "Workspace name must be 2 to 100 characters.")
        cur["workspace_name"] = name
    for field, allowed in (("language", LANG_OPTS), ("timezone", TZ_OPTS), ("date_format", DATE_OPTS), ("brand_font", FONT_OPTS)):
        value = getattr(body, field)
        if value is not None:
            if value not in allowed:
                raise HTTPException(400, f"Unknown {field.replace('_', ' ')}.")
            cur[field] = value
    if body.brand_colors is not None:
        if len(body.brand_colors) > 6 or any(not re.fullmatch(r"#[0-9a-fA-F]{6}", c) for c in body.brand_colors):
            raise HTTPException(400, "Use up to 6 colours in #RRGGBB format.")
        cur["brand_colors"] = [c.lower() for c in body.brand_colors]
    if body.automation is not None:
        if any(k not in AUTO_KEYS for k in body.automation):
            raise HTTPException(400, "Unknown automation setting.")
        cur["automation"] = {**cur["automation"], **{k: bool(v) for k, v in body.automation.items()}}
    save_ws(cur, user["id"])
    return {"ok": True}


@app.put("/api/settings/me")
def update_me(body: MeIn, user=Depends(current_user)):
    with pool.connection() as conn:
        mine = {**USER_DEFAULTS, **_user_settings(conn, user["id"])}
        mine["notifications"] = {**USER_DEFAULTS["notifications"], **(mine.get("notifications") or {})}
        name = None
        if body.name is not None:
            name = body.name.strip()
            if not 2 <= len(name) <= 100:
                raise HTTPException(400, "Name must be 2 to 100 characters.")
        if body.theme is not None:
            if body.theme not in ("light", "dark", "system"):
                raise HTTPException(400, "Unknown theme.")
            mine["theme"] = body.theme
        if body.notifications is not None:
            if any(k not in USER_DEFAULTS["notifications"] for k in body.notifications):
                raise HTTPException(400, "Unknown notification setting.")
            mine["notifications"] = {**mine["notifications"], **{k: bool(v) for k, v in body.notifications.items()}}
        table, acct = ("superadmins", -user["id"]) if user["id"] < 0 else ("users", user["id"])
        conn.execute(f"UPDATE {table} SET name=COALESCE(%s, name), settings=%s WHERE id=%s", (name, Jsonb(mine), acct))
        # conn.execute("UPDATE users SET name=COALESCE(%s, name), settings=%s WHERE id=%s", (name, Jsonb(mine), user["id"]))
        if name:
            audit(conn, user["id"], "profile_updated", None)
    return {"ok": True}


# ---------------- Team ----------------
@app.get("/api/team")
def team(user=Depends(current_user)):
    with pool.connection() as conn:
        if user["role"] in MANAGER_ROLES:
            return conn.execute("SELECT id, name, email, role, plan, is_active FROM users ORDER BY created_at").fetchall()
        return conn.execute("SELECT id, name, email, role, plan, is_active FROM users WHERE id=%s", (user["id"],)).fetchall()


@app.post("/api/team")
def add_member(body: TeamIn, user=Depends(require_manager)):
    name, email = body.name.strip(), body.email.strip().lower()
    if not 2 <= len(name) <= 100:
        raise HTTPException(400, "Name must be 2 to 100 characters.")
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(400, "Enter a valid email address.")
    if body.role != "user":
        raise HTTPException(400, "Role must be member or manager.")
    check_password(body.password)
    with pool.connection() as conn:
        if conn.execute("SELECT 1 FROM superadmins WHERE email=%s", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists.")
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    try:
        with pool.connection() as conn:
            new = conn.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (%s,%s,%s,%s) RETURNING id",
                (name, email, pw_hash, body.role),
            ).fetchone()
            audit(conn, user["id"], "member_added", None, {"user_id": new["id"], "role": body.role})
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "An account with this email already exists.")
    return {"id": new["id"]}


@app.put("/api/team/{uid}")
def update_member(uid: int, body: TeamUpdate, user=Depends(require_manager)):
    if uid == user["id"]:
        raise HTTPException(400, "You cannot change your own role or access.")
    if body.role is not None and body.role != "user":
        raise HTTPException(400, "Role must be member or manager.")
    with pool.connection() as conn:
        target = conn.execute("SELECT role FROM users WHERE id=%s", (uid,)).fetchone()
        if not target:
            raise HTTPException(404, "Member not found.")
        if target["role"] == "super_admin" and user["role"] != "super_admin":
            raise HTTPException(403, "Only a super admin can change a super admin.")
        conn.execute("UPDATE users SET role=COALESCE(%s, role), is_active=COALESCE(%s, is_active) WHERE id=%s",
                     (body.role, body.is_active, uid))
        audit(conn, user["id"], "member_updated", None, {"user_id": uid, "role": body.role, "is_active": body.is_active})
    return {"ok": True}


# ---------------- Brand logo and profile photos ----------------
def _image_ok(data: bytes) -> bool:
    return data[:8] == b"\x89PNG\r\n\x1a\n" or data[:3] == b"\xff\xd8\xff"


@app.post("/api/brand/logo")
async def upload_logo(file: UploadFile = File(...), user=Depends(require_manager)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(400, "Use a PNG or JPG image.")
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "The logo is larger than 5 MB.")
    if not _image_ok(data):
        raise HTTPException(400, "That file is not a real PNG or JPG image.")
    folder = STORAGE_DIR / "brand"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("logo.*"):
        old.unlink(missing_ok=True)
    (folder / f"logo{ext}").write_bytes(data)
    cur = get_ws()
    cur["logo"] = f"brand/logo{ext}"
    save_ws(cur, user["id"])
    return {"ok": True}


@app.get("/api/brand/logo")
def get_logo(user=Depends(current_user)):
    rel = get_ws().get("logo")
    if not rel:
        raise HTTPException(404, "No logo yet.")
    path = (STORAGE_DIR / rel).resolve()
    if not path.is_relative_to(STORAGE_DIR.resolve()) or not path.is_file():
        raise HTTPException(404, "No logo yet.")
    return FileResponse(path, media_type="image/png" if path.suffix == ".png" else "image/jpeg",
                        headers={"Cache-Control": "no-cache"})


@app.post("/api/me/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(current_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(400, "Use a PNG or JPG image.")
    data = await file.read(3 * 1024 * 1024 + 1)
    if len(data) > 3 * 1024 * 1024:
        raise HTTPException(400, "The photo is larger than 3 MB.")
    if not _image_ok(data):
        raise HTTPException(400, "That file is not a real PNG or JPG image.")
    folder = STORAGE_DIR / "avatars"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob(f"user_{user['id']}.*"):
        old.unlink(missing_ok=True)
    (folder / f"user_{user['id']}{ext}").write_bytes(data)
    with pool.connection() as conn:
        s = _user_settings(conn, user["id"])
        s["photo"] = f"avatars/user_{user['id']}{ext}"
        _save_user_settings(conn, user["id"], s)
    return {"ok": True}


def _photo_response(uid: int):
    with pool.connection() as conn:
        rel = _user_settings(conn, uid).get("photo")
    if not rel:
        raise HTTPException(404, "No photo.")
    path = (STORAGE_DIR / rel).resolve()
    if not path.is_relative_to(STORAGE_DIR.resolve()) or not path.is_file():
        raise HTTPException(404, "No photo.")
    return FileResponse(path, media_type="image/png" if path.suffix == ".png" else "image/jpeg",
                        headers={"Cache-Control": "no-cache"})


@app.get("/api/me/photo")
def my_photo(user=Depends(current_user)):
    return _photo_response(user["id"])


@app.get("/api/users/{uid}/photo")
def user_photo(uid: int, user=Depends(current_user)):
    return _photo_response(uid)


# ---------------- Audit log ----------------
@app.get("/api/audit")
def audit_logs(user=Depends(require_manager)):
    with pool.connection() as conn:
        return conn.execute(
            "SELECT a.id, a.action, a.created_at, COALESCE(u.name, sa.name) AS actor, j.seo_title AS job_title, a.job_id "
            "FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id "
            "LEFT JOIN superadmins sa ON sa.id = a.actor_admin_id "
            "LEFT JOIN content_jobs j ON j.id = a.job_id ORDER BY a.created_at DESC LIMIT 30"
            # "SELECT a.id, a.action, a.created_at, u.name AS actor, j.seo_title AS job_title, a.job_id "
            # "FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id "
            # "LEFT JOIN content_jobs j ON j.id = a.job_id ORDER BY a.created_at DESC LIMIT 30"
        ).fetchall()


# ---------------- Notifications (the bell) ----------------
@app.get("/api/notifications")
def notifications(user=Depends(current_user)):
    with pool.connection() as conn:
        mine = _user_settings(conn, user["id"])
        if (mine.get("notifications") or {}).get("in_app") is False:
            return {"items": [], "unread": 0, "muted": True}
        items = []
        if user["role"] in MANAGER_ROLES:
            for r in conn.execute(
                "SELECT j.id, COALESCE(j.seo_title, left(j.instruction, 60)) AS title, j.updated_at AS at, u.name AS owner "
                "FROM content_jobs j JOIN users u ON u.id = j.owner_id "
                "WHERE j.status = 'pending_approval' ORDER BY j.updated_at DESC LIMIT 10"
            ).fetchall():
                items.append({"id": f"a{r['id']}", "kind": "approval", "title": r["title"], "at": r["at"],
                              "text": f"{r['owner']}'s content is waiting for your approval", "href": "/app/admin/review"})
        words = {"approved": "was approved", "rejected": "was rejected", "failed": "could not be finished"}
        for r in conn.execute(
            "SELECT id, status, COALESCE(seo_title, left(instruction, 60)) AS title, updated_at AS at "
            "FROM content_jobs WHERE owner_id=%s AND status IN ('approved','rejected','failed') "
            "AND updated_at > NOW() - INTERVAL '7 days' ORDER BY updated_at DESC LIMIT 10",
            (user["id"],),
        ).fetchall():
            items.append({"id": f"s{r['id']}", "kind": r["status"], "title": r["title"], "at": r["at"],
                          "text": f"Your content {words[r['status']]}", "href": "/app/content"})
    items.sort(key=lambda i: i["at"], reverse=True)
    seen = mine.get("notif_seen_at")
    seen_dt = datetime.fromisoformat(seen) if seen else None
    unread = sum(1 for i in items if seen_dt is None or i["at"] > seen_dt)
    for i in items:
        i["at"] = i["at"].isoformat()
    return {"items": items[:15], "unread": unread, "muted": False}


@app.post("/api/notifications/seen")
def notifications_seen(user=Depends(current_user)):
    with pool.connection() as conn:
        s = _user_settings(conn, user["id"])
        s["notif_seen_at"] = datetime.now(timezone.utc).isoformat()
        _save_user_settings(conn, user["id"], s)
    return {"ok": True}


# ---------------- Super admin overview ----------------
def _month_bounds(month: str | None):
    now = datetime.now(timezone.utc)
    try:
        y, m = (int(p) for p in month.split("-")) if month else (now.year, now.month)
        start = datetime(y, m, 1, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(400, "Month must look like 2026-11.")
    end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=timezone.utc)
    prev = datetime(y - (m == 1), 12 if m == 1 else m - 1, 1, tzinfo=timezone.utc)
    return start, end, prev


def _pct(cur: int, prev: int):
    return None if not prev else round((cur - prev) / prev * 100, 1)


@app.get("/api/admin/overview")
def admin_overview(month: str | None = None, user=Depends(require_super)):
    start, end, prev = _month_bounds(month)
    days = (end - start).days
    t0 = time.perf_counter()
    with pool.connection() as conn:
        conn.execute("SELECT 1").fetchone()
        db_ms = round((time.perf_counter() - t0) * 1000)

        def n(q: str, a: tuple = ()):
            return conn.execute(q, a).fetchone()["n"]

        def between(table: str, a, b):
            return n(f"SELECT COUNT(*) AS n FROM {table} WHERE created_at >= %s AND created_at < %s", (a, b))

        def daily(table: str):
            rows = conn.execute(
                f"SELECT EXTRACT(DAY FROM created_at AT TIME ZONE 'UTC')::int AS d, COUNT(*) AS n FROM {table} "
                "WHERE created_at >= %s AND created_at < %s GROUP BY 1", (start, end),
            ).fetchall()
            out = [0] * days
            for r in rows:
                out[r["d"] - 1] = r["n"]
            return out

        users_total = n("SELECT COUNT(*) AS n FROM users")
        jobs_total = n("SELECT COUNT(*) AS n FROM content_jobs")
        assets_total = n("SELECT COUNT(*) AS n FROM assets")
        data = {
            "month": start.strftime("%Y-%m"),
            "days": days,
            "kpi": {
                "total_users": users_total,
                "users_delta": _pct(between("users", start, end), between("users", prev, start)),
                "active_subs": n("SELECT COUNT(*) AS n FROM users WHERE is_active AND plan <> 'Free Plan'"),
                "runs": jobs_total,
                "runs_delta": _pct(between("content_jobs", start, end), between("content_jobs", prev, start)),
                "content": assets_total,
                "content_delta": _pct(between("assets", start, end), between("assets", prev, start)),
            },
            "series": {"users": daily("users"), "content": daily("content_jobs"), "steps": daily("job_steps")},
            "plans": conn.execute("SELECT plan, COUNT(*) AS n FROM users GROUP BY plan ORDER BY n DESC").fetchall(),
            "recent_users": conn.execute(
                "SELECT id, name, email, plan, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 5"
            ).fetchall(),
            "activity": conn.execute(
                "SELECT a.id, a.action, a.created_at, COALESCE(u.name, sa.name) AS actor FROM audit_log a "
                "LEFT JOIN users u ON u.id = a.actor_id LEFT JOIN superadmins sa ON sa.id = a.actor_admin_id "
                "ORDER BY a.created_at DESC LIMIT 8"
                # "SELECT a.id, a.action, a.created_at, u.name AS actor FROM audit_log a "
                # "LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 8"
            ).fetchall(),
            "top": {
                "images": n("SELECT COUNT(*) AS n FROM assets WHERE kind='image'"),
                "videos": n("SELECT COUNT(*) AS n FROM assets WHERE kind='video'"),
                "posts": n("SELECT COUNT(*) AS n FROM content_jobs WHERE seo_title IS NOT NULL"),
                "carousels": n(
                    "SELECT COUNT(*) AS n FROM (SELECT j.id FROM content_jobs j JOIN assets a ON a.job_id=j.id AND a.kind='image' "
                    "GROUP BY j.id HAVING COUNT(*) >= 4 AND NOT EXISTS "
                    "(SELECT 1 FROM assets v WHERE v.job_id=j.id AND v.kind='video')) t"),
                "reels": n("SELECT COUNT(DISTINCT job_id) AS n FROM job_steps WHERE tool_name='plan_content' "
                           "AND status='done' AND output->>'aspect_ratio'='9:16'"),
            },
        }

    models = model_options()
    cf_ok = bool(os.environ.get("CF_ACCOUNT_ID") and os.environ.get("CF_API_TOKEN"))
    video_ok = bool(os.environ.get("MAGIC_HOUR_API_KEY") or os.environ.get("FFMPEG_PATH") or shutil.which("ffmpeg"))
    storage_ok = STORAGE_DIR.exists() and os.access(STORAGE_DIR, os.W_OK)
    data["health"] = [
        {"name": "Application Services", "ok": True, "note": "Running"},
        {"name": "AI Model Services", "ok": bool(models), "note": f"{len(models)} model(s) ready" if models else "No model key in .env"},
        {"name": "Media Generation", "ok": cf_ok and video_ok, "note": "Image and video tools ready" if cf_ok and video_ok else "A key or tool is missing"},
        {"name": "Storage", "ok": storage_ok, "note": "Writable" if storage_ok else "Storage folder is not writable"},
        {"name": "Database", "ok": True, "note": f"{db_ms} ms"},
    ]
    data["uptime_seconds"] = int(time.time() - START_TIME)
    data["db_ms"] = db_ms
    return data


# ---------------- Edit and clean up content ----------------
def _missing_jobs(conn, ids: list) -> set:
    """Ids of jobs that have at least one image or video file missing from the storage folder."""
    if not ids:
        return set()
    root = STORAGE_DIR.resolve()
    bad = set()
    for p in conn.execute("SELECT job_id, storage_path FROM assets WHERE job_id = ANY(%s)", (ids,)).fetchall():
        f = (STORAGE_DIR / p["storage_path"]).resolve()
        if not f.is_relative_to(root) or not f.is_file():
            bad.add(p["job_id"])
    return bad


class JobEdit(BaseModel):
    seo_title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None
    copy_by_platform: dict[str, str] | None = None


@app.put("/api/jobs/{job_id}")
def edit_job(job_id: int, body: JobEdit, user=Depends(current_user)):
    job = get_job_or_404(job_id, user)
    if job["status"] in ("generating", "publishing", "published"):
        raise HTTPException(409, "This item cannot be edited right now.")
    title, desc, tags = job["seo_title"], job["description"], job["hashtags"]
    copy = dict(job["copy_by_platform"] or {})
    if body.seo_title is not None:
        title = body.seo_title.strip()
        if not 5 <= len(title) <= 200:
            raise HTTPException(400, "The title must be 5 to 200 characters.")
    if body.description is not None:
        desc = body.description.strip()
        if not 10 <= len(desc) <= 3000:
            raise HTTPException(400, "The description must be 10 to 3000 characters.")
    if body.hashtags is not None:
        tags = []
        for t in body.hashtags:
            t = "#" + "".join(ch for ch in t if ch.isalnum() or ch == "_")
            if len(t) > 2 and t not in tags:
                tags.append(t)
        if not 1 <= len(tags) <= 15:
            raise HTTPException(400, "Use 1 to 15 valid hashtags.")
    if body.copy_by_platform is not None:
        for p, text in body.copy_by_platform.items():
            if p not in PLATFORMS:
                raise HTTPException(400, "Unknown platform.")
            text = text.strip()
            if len(text) > 3000 or (p == "x" and len(text) > 280):
                raise HTTPException(400, f"The {p} caption is too long." + (" X allows 280 characters." if p == "x" else ""))
            copy[p] = text
    resend = job["status"] == "approved"   # changed text must be approved again
    with pool.connection() as conn:
        conn.execute(
            "UPDATE content_jobs SET seo_title=%s, description=%s, hashtags=%s, copy_by_platform=%s, updated_at=NOW() WHERE id=%s",
            (title, desc, tags, Jsonb(copy), job_id),
        )
        if resend:
            conn.execute(
                "UPDATE content_jobs SET status='pending_approval', scheduled_at=NULL, scheduled_platform=NULL, "
                "approved_by=NULL, approved_at=NULL WHERE id=%s", (job_id,),
            )
        audit(conn, user["id"], "job_edited", job_id, {"sent_back": resend})
    return {"ok": True, "sent_back_for_approval": resend}


@app.post("/api/jobs/cleanup-missing")
def cleanup_missing(user=Depends(current_user)):
    """Delete this user's items whose image or video files are gone from the storage folder."""
    with pool.connection() as conn:
        ids = [r["id"] for r in conn.execute(
            "SELECT id FROM content_jobs WHERE owner_id=%s AND status <> 'generating'", (user["id"],)).fetchall()]
        bad = sorted(_missing_jobs(conn, ids))
        if bad:
            conn.execute("DELETE FROM content_jobs WHERE id = ANY(%s)", (bad,))
            audit(conn, user["id"], "jobs_cleaned_up", None, {"count": len(bad)})
    for jid in bad:
        shutil.rmtree(STORAGE_DIR / f"job_{jid}", ignore_errors=True)
        shutil.rmtree(STORAGE_DIR / "uploads" / f"job_{jid}", ignore_errors=True)
    return {"removed": len(bad)}
