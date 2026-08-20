from logging.config import fileConfig
import os

from alembic import context
from sqlalchemy import engine_from_config, pool, text

from app.database import Base
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url")))
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        if connection.dialect.name == "mssql":
            # Historical revisions contain PostgreSQL JSONB syntax. A fresh SQL Server
            # deployment uses the current portable model schema as its baseline.
            target_metadata.create_all(connection)
            connection.execute(text("IF OBJECT_ID('alembic_version', 'U') IS NULL CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
            connection.execute(text("DELETE FROM alembic_version"))
            connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260819_27')"))
            connection.commit()
            return
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
