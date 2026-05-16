import os
import sys
from pathlib import Path

# Vercel Serverless Function entry point
# Add the project root and backend directory to sys.path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend"))

# Important: The FastAPI instance MUST be defined at the top level for Vercel
# Import the app from backend.main
from backend.main import app

# Ensure Vercel can find the app object
# Vercel looks for a variable named 'app' or 'application'
# By importing 'from backend.main import app', we have 'app' at the top level
