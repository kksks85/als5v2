import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://als50:als50_local_password@localhost:5432/als50",
)

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("mssql+"):
    engine_options.update({"pool_recycle": 1800, "fast_executemany": True})
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    database = SessionLocal()
    try:
        yield database
    finally:
        database.close()
