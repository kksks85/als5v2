import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.authentication import router as authentication_router
from app.api.v1.entra import router as entra_router
from app.api.v1.health import router as health_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.records import router as records_router

app = FastAPI(
    title="Aerofix Service Management API",
    version="0.1.0",
    description="Post-delivery drone service-management API.",
)

allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(records_router, prefix="/api/v1")
app.include_router(entra_router, prefix="/api/v1")
app.include_router(authentication_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
