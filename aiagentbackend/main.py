import asyncio, os, re, time, uuid
from collections import defaultdict
from contextlib import asynccontextmanager

import bcrypt, jwt, psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel

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
            "SELECT id, name, email, plan FROM users WHERE id = %s AND is_active",
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


def set_login_cookie(response: Response, user_id: int, remember: bool):
    days = 30 if remember else 1
    response.set_cookie(
        COOKIE, make_token(user_id, days), httponly=True, samesite="lax",
        secure=False,  # set True when the site runs on HTTPS
        max_age=days * 86400 if remember else None,
    )


def public(u: dict):
    return {"name": u["name"], "email": u["email"], "plan": u["plan"]}


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
                "RETURNING id, name, email, plan",
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
            "SELECT id, name, email, plan, password_hash FROM users WHERE email = %s AND is_active",
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