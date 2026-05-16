"""
Database Connection and Session Management
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration
IS_VERCEL = os.getenv("VERCEL") == "1"
DEFAULT_DB = "/tmp/infrastructure_damage.db" if IS_VERCEL else "./infrastructure_damage.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB}")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency for FastAPI
def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables
def init_db():
    """Initialize database with all tables"""
    from database.models import Base
    Base.metadata.create_all(bind=engine)

# Drop all tables (for testing/reset)
def drop_db():
    """Drop all database tables"""
    from database.models import Base
    Base.metadata.drop_all(bind=engine)
