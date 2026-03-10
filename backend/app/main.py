from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
from pathlib import Path

from app.openai_module import chat_completion

# ─── Environment ──────────────────────────────────────────────────────────────

basedir     = os.path.abspath(os.path.dirname(__file__))
backend_dir = os.path.dirname(basedir)
dotenv_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path)

print(f"Loading .env from: {dotenv_path}")
print(f"OPENAI_API_KEY found: {bool(os.getenv('OPENAI_API_KEY'))}")

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request models ───────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    model: str = "gpt-4o-mini"
    temperature: float = 0.7

# ─── API endpoints ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/chat")
def chat(req: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    return chat_completion(messages, model=req.model, temperature=req.temperature)

# ─── Frontend (SPA) ───────────────────────────────────────────────────────────

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
