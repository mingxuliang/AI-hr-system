"""Compare SQLAlchemy models against live PostgreSQL schema."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect
from app.models.base import Base
from app.models import models  # noqa: F401
from app.models import workflow_models  # noqa: F401


def main():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set")
        sys.exit(1)

    engine = create_engine(url)
    inspector = inspect(engine)
    db_tables = set(inspector.get_table_names())
    issues = []

    for table_name, table in Base.metadata.tables.items():
        if table_name not in db_tables:
            issues.append(f"MISSING TABLE: {table_name}")
            continue

        db_cols = {c["name"]: c for c in inspector.get_columns(table_name)}
        for col in table.columns:
            if col.name not in db_cols:
                issues.append(f"MISSING COLUMN: {table_name}.{col.name} ({col.type})")
            else:
                db_type = str(db_cols[col.name]["type"])
                model_type = str(col.type)
                if _types_differ(model_type, db_type):
                    issues.append(
                        f"TYPE MISMATCH: {table_name}.{col.name} model={model_type} db={db_type}"
                    )

        for db_col in db_cols:
            if db_col not in {c.name for c in table.columns}:
                issues.append(f"EXTRA DB COLUMN: {table_name}.{db_col}")

    if issues:
        print(f"Found {len(issues)} schema issue(s):")
        for issue in issues:
            print(f"  - {issue}")
        sys.exit(1)

    print("Schema audit passed: all model columns match database.")


def _types_differ(model_type: str, db_type: str) -> bool:
    m = model_type.lower().replace(" ", "")
    d = db_type.lower().replace(" ", "")
    if m == d:
        return False
    # Enum type names differ in casing/details but map to same PG enum.
    enum_names = [
        "userrole", "positionstatus", "positionurgency", "positiontype",
        "questioncategory", "questiondifficulty", "screeningresult", "resumestatus",
        "rejectreasoncategory", "interviewresult", "interviewstatus", "offerstatus",
        "codingteststatus", "codingsubmissionstatus", "workflowstatus", "nodetype",
        "workflowexecutionstatus",
    ]
    for name in enum_names:
        if name in m and name in d:
            return False
    # Common equivalent types
    pairs = [
        ("uuid", "uuid"), ("varchar", "character varying"), ("text", "text"),
        ("boolean", "boolean"), ("integer", "integer"), ("double", "double"),
        ("json", "json"), ("jsonb", "jsonb"), ("timestamp", "timestamp"),
        ("array", "array"),
    ]
    for a, b in pairs:
        if a in m and b in d:
            return False
    return True


if __name__ == "__main__":
    main()
