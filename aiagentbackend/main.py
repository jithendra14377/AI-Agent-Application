import asyncio, os, re, time, uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path
import mimetypes
import shutil
import bcrypt, jwt, psycopg

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel
# from agent import model_options, run_agent
from agent import brains, model_options, provider_name, run_agent
from content_types import CONTENT_TYPES
BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]
SECRET = os.environ["JWT_SECRET"]
COOKIE = "sf_token"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, open=False,
                      kwargs={"row_factory": dict_row})


@asynccontextmanager
async def lifespan(app: FastAPI):
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
def make_token(user_id: int, days: int) -> str:
    return jwt.encode({"sub": str(user_id), "exp": int(time.time()) + days * 86400},
                      SECRET, algorithm="HS256")


def get_user(user_id: int):
    with pool.connection() as conn:
        return conn.execute(
            "SELECT id, name, email, plan, role FROM users WHERE id = %s AND is_active",
            (user_id,),
        ).fetchone()


def read_token(token: str):
    try:
        uid = int(jwt.decode(token, SECRET, algorithms=["HS256"])["sub"])
    except Exception:
        return None
    return get_user(uid)


def current_user(request: Request):
    user = read_token(request.cookies.get(COOKIE, ""))
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user

def require_manager(user=Depends(current_user)):
    if user["role"] != "manager":
        raise HTTPException(403, "Only managers can do this.")
    return user

def set_login_cookie(response: Response, user_id: int, remember: bool):
    days = 30 if remember else 1
    response.set_cookie(
        COOKIE, make_token(user_id, days), httponly=True, samesite="lax",
        secure=False,  # set True when the site runs on HTTPS
        max_age=days * 86400 if remember else None,
    )


# def public(u: dict):
#     return {"name": u["name"], "email": u["email"], "plan": u["plan"]}
def public(u: dict):
    return {"name": u["name"], "email": u["email"], "plan": u["plan"], "role": u["role"]}

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
    if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        raise HTTPException(400, "Password must be at least 8 characters with a letter and a number.")
    if len(pw.encode()) > 72:
        raise HTTPException(400, "Password is too long (maximum 72 bytes).")

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

    set_login_cookie(response, user["id"], False)
    return {"user": public(user)}


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    FAILS[ip] = [t for t in FAILS[ip] if now - t < 60]
    if len(FAILS[ip]) >= 5:
        raise HTTPException(429, "Too many attempts. Try again in a minute.")

    email = body.email.strip().lower()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT id, name, email, plan, role, password_hash FROM users WHERE email = %s AND is_active",
            (email,),
        ).fetchone()

    pw_bytes = body.password.encode()
    ok = False
    if len(pw_bytes) <= 72:
        stored = row["password_hash"] if row else DUMMY_HASH
        ok = bcrypt.checkpw(pw_bytes, stored.encode())

    if not (row and ok):
        FAILS[ip].append(now)
        raise HTTPException(401, "Incorrect username or password")

    set_login_cookie(response, row["id"], body.remember)
    return {"user": public(row)}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return public(user)


# ---------------- Dashboard ----------------
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


# ---------------- Content jobs (AI agent) ----------------
class JobIn(BaseModel):
    instruction: str
    brief: str


def get_job_or_404(job_id: int, user: dict):
    with pool.connection() as conn:
        job = conn.execute(
            "SELECT id, owner_id, status, instruction, seo_title, description, hashtags, "
            "copy_by_platform, created_at FROM content_jobs WHERE id = %s",
            (job_id,),
        ).fetchone()
    if not job or (job["owner_id"] != user["id"] and user["role"] != "manager"):
        raise HTTPException(404, "Job not found.")
    return job


# @app.post("/api/jobs")
# def create_job(body: JobIn, background: BackgroundTasks, user=Depends(current_user)):
#     instruction, brief = body.instruction.strip(), body.brief.strip()
#     if not 5 <= len(instruction) <= 1000:
#         raise HTTPException(400, "Instruction must be 5 to 1000 characters.")
#     if not 10 <= len(brief) <= 8000:
#         raise HTTPException(400, "Brief must be 10 to 8000 characters.")
#     with pool.connection() as conn:
#         recent = conn.execute(
#             "SELECT COUNT(*) AS n FROM content_jobs WHERE owner_id=%s AND created_at > NOW() - INTERVAL '1 hour'",
#             (user["id"],),
#         ).fetchone()["n"]
#         if recent >= 10:
#             raise HTTPException(429, "Too many jobs this hour. Try again later.")
#         job = conn.execute(
#             "INSERT INTO content_jobs (owner_id, instruction, brief, status) VALUES (%s,%s,%s,'generating') RETURNING id",
#             (user["id"], instruction, brief),
#         ).fetchone()
#         conn.execute(
#             "INSERT INTO audit_log (actor_id, action, job_id) VALUES (%s,'job_created',%s)",
#             (user["id"], job["id"]),
#         )
#     background.add_task(run_agent, pool, job["id"])
#     return {"id": job["id"]}

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


# @app.post("/api/jobs")
# async def create_job(
#     background: BackgroundTasks,
#     instruction: str = Form(...),
#     files: list[UploadFile] | None = File(default=None),
#     user=Depends(current_user),
# ):
#     instruction = instruction.strip()
#     if not 5 <= len(instruction) <= 4000:
#         raise HTTPException(400, "Describe what you want to create (5 to 4000 characters).")
#     files = files or []
#     if len(files) > MAX_FILES:
#         raise HTTPException(400, f"You can attach up to {MAX_FILES} files.")

#     uploads, total = [], 0
#     for f in files:
#         ext = Path(f.filename or "").suffix.lower()
#         if ext not in ALLOWED_UPLOADS:
#             raise HTTPException(400, "Allowed attachments: images, PDF, TXT, MD and CSV.")
#         data = await f.read(MAX_FILE_BYTES + 1)
#         total += len(data)
#         if len(data) > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
#             raise HTTPException(400, "Attachments are too large (9 MB in total).")
#         uploads.append((ext, data))

#     with pool.connection() as conn:
#         recent = conn.execute(
#             "SELECT COUNT(*) AS n FROM content_jobs WHERE owner_id=%s AND created_at > NOW() - INTERVAL '1 hour'",
#             (user["id"],),
#         ).fetchone()["n"]
#         if recent >= 10:
#             raise HTTPException(429, "Too many jobs this hour. Try again later.")
#         job = conn.execute(
#             "INSERT INTO content_jobs (owner_id, instruction, brief, status) VALUES (%s,%s,'','generating') RETURNING id",
#             (user["id"], instruction),
#         ).fetchone()
#         conn.execute(
#             "INSERT INTO audit_log (actor_id, action, job_id) VALUES (%s,'job_created',%s)",
#             (user["id"], job["id"]),
#         )

#     if uploads:
#         folder = STORAGE_DIR / "uploads" / f"job_{job['id']}"
#         folder.mkdir(parents=True, exist_ok=True)
#         for i, (ext, data) in enumerate(uploads, 1):
#             (folder / f"attachment_{i}{ext}").write_bytes(data)

#     background.add_task(run_agent, pool, job["id"])
#     return {"id": job["id"]}

@app.post("/api/jobs")
async def create_job(
    background: BackgroundTasks,
    instruction: str = Form(...),
    content_type: str = Form("auto"),
    model: str = Form("auto"),
    files: list[UploadFile] | None = File(default=None),
    user=Depends(current_user),
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
        # uploads.append((ext, data, Path(f.filename or "").stem))

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
        conn.execute(
            "INSERT INTO audit_log (actor_id, action, job_id) VALUES (%s,'job_created',%s)",
            (user["id"], job["id"]),
        )

    if uploads:
        folder = STORAGE_DIR / "uploads" / f"job_{job['id']}"
        folder.mkdir(parents=True, exist_ok=True)
        for i, (ext, data) in enumerate(uploads, 1):
            (folder / f"attachment_{i}{ext}").write_bytes(data)
        # for i, (ext, data, stem) in enumerate(uploads, 1):
        #     safe = re.sub(r"[^A-Za-z0-9-]", "", stem)[:30]
        #     (folder / f"attachment_{i}_{safe}{ext}").write_bytes(data)

    background.add_task(run_agent, pool, job["id"])
    return {"id": job["id"]}

# @app.get("/api/jobs")
# def list_jobs(user=Depends(current_user)):
#     with pool.connection() as conn:
#         rows = conn.execute(
#             "SELECT id, status, seo_title, left(instruction, 100) AS instruction, created_at "
#             "FROM content_jobs WHERE owner_id = %s ORDER BY created_at DESC LIMIT 500",
#             (user["id"],),
#         ).fetchall()
#     return rows

@app.get("/api/jobs")
def list_jobs(user=Depends(current_user)):
    with pool.connection() as conn:
        rows = conn.execute(
            """
            SELECT j.id, j.status, j.seo_title, left(j.instruction, 100) AS instruction, j.created_at,
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
    return rows

@app.get("/api/jobs/{job_id}")
def read_job(job_id: int, user=Depends(current_user)):
    job = get_job_or_404(job_id, user)
    with pool.connection() as conn:
        steps = conn.execute(
            "SELECT id, step_no, tool_name, status, output FROM job_steps WHERE job_id=%s ORDER BY step_no",
            (job_id,),
        ).fetchall()
        assets = conn.execute(
            "SELECT id, kind FROM assets WHERE job_id=%s ORDER BY id", (job_id,)
        ).fetchall()
    return {**job, "steps": steps, "assets": assets}


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
    if not asset or (asset["owner_id"] != user["id"] and user["role"] != "manager"):
        raise HTTPException(404, "Not found.")

    path = (STORAGE_DIR / asset["storage_path"]).resolve()
    if not path.is_relative_to(STORAGE_DIR.resolve()) or not path.is_file():
        raise HTTPException(404, "Not found.")

    media = "video/mp4" if asset["kind"] == "video" else (mimetypes.guess_type(str(path))[0] or "image/jpeg")
    return FileResponse(path, media_type=media, filename=path.name if download else None)


# # ---------------- Assets ----------------

# @app.get("/api/assets/{asset_id}")
# def asset_file(asset_id: int, user=Depends(current_user)):
#     with pool.connection() as conn:
#         asset = conn.execute(
#             """
#             SELECT a.storage_path, a.kind
#             FROM assets a
#             JOIN content_jobs j ON j.id = a.job_id
#             WHERE a.id = %s
#             """,
#             (asset_id,),
#         ).fetchone()

#     if not asset:
#         raise HTTPException(404, "Asset not found")

#     path = (STORAGE_DIR / asset["storage_path"]).resolve()

#     if not path.is_relative_to(STORAGE_DIR.resolve()):
#         raise HTTPException(403, "Invalid asset path")

#     if not path.is_file():
#         raise HTTPException(404, "Asset file not found")

#     media = (
#         "video/mp4"
#         if asset["kind"] == "video"
#         else (mimetypes.guess_type(str(path))[0] or "image/jpeg")
#     )

#     media = "video/mp4" if a["kind"] == "video" else (mimetypes.guess_type(str(path))[0] or "image/jpeg")
#     return FileResponse(path, media_type=media)


# ============================================================================
# Paste this block at the very END of main.py (after the earlier additions).
# ============================================================================
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


# ============================================================================
# Paste this block at the very END of main.py (after the earlier additions).
# It uses audit() from the Calendar block, so that block must already be there.
# ============================================================================
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


def check_password(pw: str):
    if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        raise HTTPException(400, "Password must be at least 8 characters with a letter and a number.")
    if len(pw.encode()) > 72:
        raise HTTPException(400, "Password is too long (maximum 72 bytes).")


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
    role: str = "member"


class TeamUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None


# ---------------- Read everything the Settings screen needs ----------------
@app.get("/api/settings")
def read_settings(user=Depends(current_user)):
    with pool.connection() as conn:
        row = conn.execute("SELECT settings FROM users WHERE id=%s", (user["id"],)).fetchone()
    mine = {**USER_DEFAULTS, **((row["settings"] if row else None) or {})}
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
        row = conn.execute("SELECT settings FROM users WHERE id=%s", (user["id"],)).fetchone()
        mine = {**USER_DEFAULTS, **((row["settings"] if row else None) or {})}
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
        conn.execute("UPDATE users SET name=COALESCE(%s, name), settings=%s WHERE id=%s", (name, Jsonb(mine), user["id"]))
        if name:
            audit(conn, user["id"], "profile_updated", None)
    return {"ok": True}


@app.post("/api/auth/change-password")
def change_password(body: PasswordIn, user=Depends(current_user)):
    key = f"pw:{user['id']}"
    now = time.time()
    FAILS[key] = [t for t in FAILS[key] if now - t < 60]
    if len(FAILS[key]) >= 5:
        raise HTTPException(429, "Too many attempts. Try again in a minute.")
    check_password(body.new)
    with pool.connection() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id=%s", (user["id"],)).fetchone()
        cur_bytes = body.current.encode()
        if len(cur_bytes) > 72 or not bcrypt.checkpw(cur_bytes, row["password_hash"].encode()):
            FAILS[key].append(now)
            raise HTTPException(400, "Your current password is incorrect.")
        new_hash = bcrypt.hashpw(body.new.encode(), bcrypt.gensalt()).decode()
        conn.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, user["id"]))
        audit(conn, user["id"], "password_changed", None)
    return {"ok": True}


# ---------------- Team ----------------
@app.get("/api/team")
def team(user=Depends(current_user)):
    with pool.connection() as conn:
        if user["role"] == "manager":
            return conn.execute("SELECT id, name, email, role, plan, is_active FROM users ORDER BY created_at").fetchall()
        return conn.execute("SELECT id, name, email, role, plan, is_active FROM users WHERE id=%s", (user["id"],)).fetchall()


@app.post("/api/team")
def add_member(body: TeamIn, user=Depends(require_manager)):
    name, email = body.name.strip(), body.email.strip().lower()
    if not 2 <= len(name) <= 100:
        raise HTTPException(400, "Name must be 2 to 100 characters.")
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(400, "Enter a valid email address.")
    if body.role not in ("member", "manager"):
        raise HTTPException(400, "Role must be member or manager.")
    check_password(body.password)
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
    if body.role is not None and body.role not in ("member", "manager"):
        raise HTTPException(400, "Role must be member or manager.")
    with pool.connection() as conn:
        if not conn.execute("SELECT 1 FROM users WHERE id=%s", (uid,)).fetchone():
            raise HTTPException(404, "Member not found.")
        conn.execute("UPDATE users SET role=COALESCE(%s, role), is_active=COALESCE(%s, is_active) WHERE id=%s",
                     (body.role, body.is_active, uid))
        audit(conn, user["id"], "member_updated", None, {"user_id": uid, "role": body.role, "is_active": body.is_active})
    return {"ok": True}


# ---------------- Brand logo ----------------
@app.post("/api/brand/logo")
async def upload_logo(file: UploadFile = File(...), user=Depends(require_manager)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(400, "Use a PNG or JPG image.")
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "The logo is larger than 5 MB.")
    if not (data[:8] == b"\x89PNG\r\n\x1a\n" or data[:3] == b"\xff\xd8\xff"):
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


# ---------------- Audit log ----------------
@app.get("/api/audit")
def audit_logs(user=Depends(require_manager)):
    with pool.connection() as conn:
        return conn.execute(
            "SELECT a.id, a.action, a.created_at, u.name AS actor, j.seo_title AS job_title, a.job_id "
            "FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id "
            "LEFT JOIN content_jobs j ON j.id = a.job_id ORDER BY a.created_at DESC LIMIT 30"
        ).fetchall()