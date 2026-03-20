"""
RateMyHotlap API — FastAPI application entry-point.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import get_settings
from api.init_db import init_pool, init_tables, close_pool
from api.routers import upload, laps, import_jobs, compare, share


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    # ── startup ──
    settings = get_settings()
    try:
        init_pool()
        init_tables()
        print("✓ Database pool initialized")
    except Exception as e:
        print(f"⚠ Database initialization failed (app will start anyway): {e}")

    yield

    # ── shutdown ──
    close_pool()
    print("✓ Database pool closed")


app = FastAPI(
    title="RateMyHotlap API",
    description="Racing telemetry analysis platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(upload.router)
app.include_router(laps.router)
app.include_router(import_jobs.router)
app.include_router(compare.router)
app.include_router(share.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to RateMyHotlap API!"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
