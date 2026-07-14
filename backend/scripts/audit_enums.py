"""Verify Python enum `.value` labels exist in PostgreSQL enum types."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import enum
from sqlalchemy import create_engine, text
from app.models import models
from app.models import workflow_models


ENUM_CLASSES = [
    (models.UserRole, "userrole"),
    (models.PositionStatus, "positionstatus"),
    (models.PositionUrgency, "positionurgency"),
    (models.PositionType, "positiontype"),
    (models.QuestionCategory, "questioncategory"),
    (models.QuestionDifficulty, "questiondifficulty"),
    (models.ScreeningResult, "screeningresult"),
    (models.ResumeStatus, "resumestatus"),
    (models.RejectReasonCategory, "rejectreasoncategory"),
    (models.InterviewResult, "interviewresult"),
    (models.InterviewStatus, "interviewstatus"),
    (models.OfferStatus, "offerstatus"),
    (models.CodingTestStatus, "codingteststatus"),
    (models.CodingSubmissionStatus, "codingsubmissionstatus"),
    (workflow_models.WorkflowStatus, "workflowstatus"),
    (workflow_models.NodeType, "nodetype"),
    (workflow_models.ExecutionStatus, "workflowexecutionstatus"),
]


def main():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set")
        sys.exit(1)

    engine = create_engine(url)
    issues = []

    with engine.connect() as conn:
        for enum_cls, pg_name in ENUM_CLASSES:
            if not issubclass(enum_cls, enum.Enum):
                continue
            py_values = {m.value for m in enum_cls}
            rows = conn.execute(
                text(
                    "SELECT e.enumlabel FROM pg_type t "
                    "JOIN pg_enum e ON t.oid = e.enumtypid "
                    "WHERE t.typname = :name"
                ),
                {"name": pg_name},
            ).fetchall()
            db_labels = {r[0] for r in rows}
            missing = py_values - db_labels
            if missing:
                issues.append(f"{pg_name}: missing PG labels {sorted(missing)}")

            uppercase_only = {
                label for label in db_labels
                if label.isupper() or (label.upper() == label and "_" in label)
            }
            if uppercase_only & py_values:
                pass  # overlap impossible
            stale_upper = uppercase_only - {v.upper() for v in py_values}
            # Warn if rows still use uppercase (checked separately below)

        row_checks = [
            ("users", "role", "userrole"),
            ("positions", "status", "positionstatus"),
            ("resumes", "status", "resumestatus"),
            ("interviews", "result", "interviewresult"),
            ("interviews", "status", "interviewstatus"),
        ]
        for table, column, pg_name in row_checks:
            bad = conn.execute(
                text(
                    f"SELECT DISTINCT {column}::text AS v FROM {table} "
                    f"WHERE {column}::text <> lower({column}::text) "
                    f"AND {column}::text = upper({column}::text)"
                )
            ).fetchall()
            if bad:
                issues.append(
                    f"{table}.{column}: rows still use UPPERCASE values {[r[0] for r in bad]}"
                )

    if issues:
        print(f"Enum audit found {len(issues)} issue(s):")
        for issue in issues:
            print(f"  - {issue}")
        sys.exit(1)

    print("Enum audit passed: all Python enum values exist in PostgreSQL.")


if __name__ == "__main__":
    main()
