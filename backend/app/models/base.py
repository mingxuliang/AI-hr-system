import enum

from sqlalchemy import Enum
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


def pg_enum(enum_class: type[enum.Enum], name: str) -> Enum:
    """PostgreSQL enum column that always persists enum `.value` (lowercase snake_case)."""
    return Enum(
        enum_class,
        name=name,
        values_callable=lambda obj: [member.value for member in obj],
        create_type=False,
    )
