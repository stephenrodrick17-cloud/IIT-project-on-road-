import os
import sys
from pathlib import Path

# Vercel Serverless Function entry point
# Add the project root and backend directory to sys.path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend"))

# The FastAPI instance MUST be defined at the top level for Vercel's static analyzer
# Do NOT wrap this in a try/except or function
from backend.main import app

# Vercel will now find the 'app' variable immediately
