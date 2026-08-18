from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models
from .database import SessionLocal, engine
from .routers import drawings, drawings_ingest, flags, knowledge, sms, users, ws
from .seed import seed

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Redline API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(drawings.router)
app.include_router(drawings_ingest.router)
app.include_router(flags.router)
app.include_router(knowledge.router)
app.include_router(sms.router)
app.include_router(users.router)
app.include_router(ws.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
