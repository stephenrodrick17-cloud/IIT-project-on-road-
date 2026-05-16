import os
import sys
from pathlib import Path
import logging

# Configure diagnostic logging for Vercel
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_index")

# Vercel Serverless Function entry point
# Add the project root and backend directory to sys.path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend"))

logger.info(f"System Path: {sys.path}")
logger.info(f"Root Directory: {root_dir}")

# The FastAPI instance MUST be available at the top level
try:
    # Try absolute import first
    from backend.main import app
    logger.info("Successfully imported app from backend.main")
except ImportError as e:
    logger.error(f"Failed to import app from backend.main: {e}")
    try:
        # Fallback to direct import if path handling differs on Vercel
        sys.path.insert(0, str(root_dir / "backend"))
        import main
        app = main.app
        logger.info("Successfully imported app using fallback 'import main'")
    except Exception as e2:
        logger.error(f"Fallback import also failed: {e2}")
        raise e

# This object 'app' will be used by Vercel
