import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("mssql+"):
    engine_options.update({"pool_recycle": 1800})
    if "driver=FreeTDS" not in DATABASE_URL:
        engine_options["fast_executemany"] = True
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
