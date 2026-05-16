"""
Infrastructure Damage Detection and Alert System
Main FastAPI Application
"""

import sys
import os
from pathlib import Path

# Add backend directory to path so app modules can be imported
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Add parent directory to path for database and other modules
parent_dir = backend_dir.parent
sys.path.insert(0, str(parent_dir))

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import routes
from app.routes import detection, alerts, contractors, dashboard, datasets, monitoring, feedback, ai_chat, location_intelligence

# Ensure uploads directory exists
# On Vercel, use /tmp for writable storage
IS_VERCEL = os.getenv("VERCEL") == "1"
try:
    UPLOAD_DIR = Path("/tmp/uploads") if IS_VERCEL else Path("uploads")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"Warning: Could not create upload directory: {e}")
    UPLOAD_DIR = Path("/tmp") # Fallback to /tmp which is always writable on Lambda

# Create FastAPI app
app = FastAPI(
    title="Infrastructure Damage Detection API",
    description="AI-powered system for detecting and reporting infrastructure damage",
    version="1.0.0"
)

# Add CORS middleware
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",")
allowed_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=allowed_methods,
    allow_headers=["*"],
)

# Include routers
app.include_router(detection.router, prefix="/api/detection", tags=["Detection"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(contractors.router, prefix="/api/contractors", tags=["Contractors"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["Datasets"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback & Retraining"])
app.include_router(ai_chat.router, prefix="/api/ai", tags=["AI Assistant"])
app.include_router(location_intelligence.router, prefix="/api/location", tags=["Location Intelligence"])

# Mount static files for archives
# Base project directory (Road portfolio/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
for archive in ["archive (2)", "archive (3)", "archive (4)"]:
    archive_path = BASE_DIR / archive
    if archive_path.exists():
        # URL path will be /static/archive (2)/...
        app.mount(f"/static/{archive}", StaticFiles(directory=str(archive_path)), name=f"static-{archive}")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Check API health status"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "Infrastructure Damage Detection API"
    }

# Root endpoint
@app.get("/api")
async def api_root():
    """API root with information"""
    return {
        "service": "Infrastructure Damage Detection API",
        "version": "1.0.0",
        "endpoints": {
            "detection": "/api/detection",
            "alerts": "/api/alerts",
            "contractors": "/api/contractors",
            "dashboard": "/api/dashboard",
            "datasets": "/api/datasets",
            "health": "/health",
            "docs": "/docs"
        }
    }

# Mount static files for the frontend build
# This should be at the end to not interfere with API routes
frontend_path = Path(__file__).resolve().parent.parent / "frontend" / "build"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        """Root endpoint when frontend is not built"""
        return {
            "message": "Infrastructure Damage Detection API is running. Frontend build not found.",
            "api_docs": "/docs"
        }

# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error": True},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    logger.error(f"Unexpected error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": True},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
