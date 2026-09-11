import os
from pathlib import Path
from dotenv import load_dotenv

# Load als5v2/.env
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]

print("=" * 80)
print(DATABASE_URL)
print("=" * 80)

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("mssql+"):
    engine_options.update({"pool_recycle": 1800})
    if "driver=FreeTDS" in DATABASE_URL:
        engine_options["use_setinputsizes"] = False
    else:
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
