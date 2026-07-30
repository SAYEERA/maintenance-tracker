import os
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

# Render sets DATABASE_URL for us once it's deployed (something like
# postgresql://user:pass@host:5432/dbname). Locally I never bothered
# installing Postgres, so if that var isn't set it just falls back to a
# SQLite file - same code path either way, just a different connection string
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./maintenance.db")

# Render (and Heroku before it) hands back "postgres://" but SQLAlchemy 2.x
# insists on "postgresql://" - tripped me up the first time, so patching it here
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class MaintenanceRequest(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    property = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Open")
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
