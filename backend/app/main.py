from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
import os
from pathlib import Path

from app.database import init_db, AsyncSessionLocal
from app.routers.auth_router import router as auth_router
from app.routers.recipes_router import router as recipes_router
from app.routers.larder_router import router as larder_router
from app.routers.friends_router import router as friends_router
from app.routers.shopping_router import router as shopping_router
from app.routers.ingredients_router import router as ingredients_router
from app.services.ingredient_seeder import seed_ingredients
from app.services.ingredient_backfill import backfill_all_recipes
import asyncio

# ─── Environment ──────────────────────────────────────────────────────────────

basedir = os.path.abspath(os.path.dirname(__file__))
backend_dir = os.path.dirname(basedir)
load_dotenv(os.path.join(backend_dir, ".env"))

print(f"OPENAI_API_KEY found: {bool(os.getenv('OPENAI_API_KEY'))}")
print(f"DATABASE_URL found:   {bool(os.getenv('DATABASE_URL'))}")
print(f"SECRET_KEY found:     {bool(os.getenv('SECRET_KEY'))}")

# ─── Lifespan ─────────────────────────────────────────────────────────────────

async def _background_backfill():
    """Resolve ingredient_id on any recipes that pre-date the taxonomy.
    Runs in the background so it doesn't block the app from accepting
    requests. Idempotent: skips ingredients that already have an id.
    """
    async with AsyncSessionLocal() as db:
        try:
            result = await backfill_all_recipes(db, allow_llm=True)
            if result["recipes_changed"]:
                print(
                    f"Ingredient backfill: stamped {result['ingredients_resolved']} "
                    f"ingredients across {result['recipes_changed']} recipes."
                )
        except Exception as e:
            print(f"Background ingredient backfill failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as db:
        try:
            await seed_ingredients(db)
        except Exception as e:
            print(f"Ingredient seeding skipped: {e}")
    # Hold a reference on app.state so the GC can't collect the task
    # mid-run (asyncio.create_task without a ref is a known footgun).
    app.state.backfill_task = asyncio.create_task(_background_backfill())
    yield

# ─── Security headers middleware ──────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if os.getenv("RAILWAY_ENVIRONMENT"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(lifespan=lifespan)

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
_allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)

# ─── API routers ──────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(recipes_router)
app.include_router(larder_router)
app.include_router(friends_router)
app.include_router(shopping_router)
app.include_router(ingredients_router)

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
        return FileResponse(
            static_dir / "index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )
