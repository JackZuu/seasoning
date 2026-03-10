from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from pathlib import Path

from app.database import init_db
from app.routers.auth_router import router as auth_router
from app.routers.recipes_router import router as recipes_router

# ─── Environment ──────────────────────────────────────────────────────────────

basedir = os.path.abspath(os.path.dirname(__file__))
backend_dir = os.path.dirname(basedir)
load_dotenv(os.path.join(backend_dir, ".env"))

print(f"OPENAI_API_KEY found: {bool(os.getenv('OPENAI_API_KEY'))}")
print(f"DATABASE_URL found:   {bool(os.getenv('DATABASE_URL'))}")
print(f"SECRET_KEY found:     {bool(os.getenv('SECRET_KEY'))}")

# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API routers ──────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(recipes_router)

@app.get("/api/health")
def health():
    return {"ok": True}

# ─── Frontend (SPA) — must be last ────────────────────────────────────────────

static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        if full_path and not full_path.startswith("api"):
            file_path = static_dir / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")
