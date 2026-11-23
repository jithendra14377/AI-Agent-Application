import asyncio, os, re, time, uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path
import mimetypes
import bcrypt, jwt, psycopg

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel
from agent import model_options, run_agent
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
        # uploads.append((ext, data))
        uploads.append((ext, data, Path(f.filename or "").stem))

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
        # for i, (ext, data) in enumerate(uploads, 1):
        #     (folder / f"attachment_{i}{ext}").write_bytes(data)
        for i, (ext, data, stem) in enumerate(uploads, 1):
            safe = re.sub(r"[^A-Za-z0-9-]", "", stem)[:30]
            (folder / f"attachment_{i}_{safe}{ext}").write_bytes(data)

    background.add_task(run_agent, pool, job["id"])
    return {"id": job["id"]}

@app.get("/api/jobs")
def list_jobs(user=Depends(current_user)):
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT id, status, seo_title, left(instruction, 100) AS instruction, created_at "
            "FROM content_jobs WHERE owner_id = %s ORDER BY created_at DESC LIMIT 500",
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
def asset_file(asset_id: int, user=Depends(current_user)):
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
    return FileResponse(path, media_type=media)


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