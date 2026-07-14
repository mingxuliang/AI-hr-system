"""normalize enum values to lowercase

Revision ID: l1m2n3o4p5q6
Revises: k0l1m2n3o4p5
Create Date: 2026-07-13

"""
from alembic import op

revision = 'l1m2n3o4p5q6'
down_revision = 'k0l1m2n3o4p5'
branch_labels = None
depends_on = None

# Lowercase values that Python enums persist via pg_enum(values_callable).
ENUM_VALUES = {
    'userrole': ['admin', 'hr', 'interviewer'],
    'positionstatus': ['open', 'closed', 'published'],
    'positionurgency': ['low', 'medium', 'high', 'urgent'],
    'positiontype': ['full_time', 'part_time', 'contract', 'internship'],
    'questioncategory': ['technical', 'management', 'hr', 'other'],
    'questiondifficulty': ['junior', 'intermediate', 'senior'],
    'screeningresult': ['pending', 'passed', 'rejected', 'waitlist'],
    'resumestatus': [
        'pending_screening', 'pending_review', 'pending_dept_review', 'pending_hr_decision',
        'auto_rejected_pending_review', 'pending_interview', 'interview_passed', 'interview_failed',
        'offer_pending', 'offer_accepted', 'offer_rejected', 'onboarding', 'completed', 'rejected', 'waitlist',
    ],
    'interviewresult': ['pending', 'passed', 'rejected', 'waitlist', 'hired', 'next_round'],
    'interviewstatus': ['scheduled', 'in_progress', 'analyzing', 'completed', 'cancelled'],
    'offerstatus': ['draft', 'pending', 'sent', 'accepted', 'rejected', 'expired', 'withdrawn'],
    'codingteststatus': ['draft', 'published', 'closed'],
    'codingsubmissionstatus': ['draft', 'submitted', 'evaluated'],
}

# Map legacy UPPERCASE labels stored in rows to lowercase enum values.
DATA_NORMALIZATION = {
    ('users', 'role'): ('userrole', {
        'ADMIN': 'admin', 'HR': 'hr', 'INTERVIEWER': 'interviewer',
    }),
    ('positions', 'status'): ('positionstatus', {
        'OPEN': 'open', 'CLOSED': 'closed', 'PUBLISHED': 'published',
    }),
    ('positions', 'urgency'): ('positionurgency', {
        'LOW': 'low', 'MEDIUM': 'medium', 'HIGH': 'high', 'URGENT': 'urgent',
    }),
    ('positions', 'position_type'): ('positiontype', {
        'FULL_TIME': 'full_time', 'PART_TIME': 'part_time',
        'CONTRACT': 'contract', 'INTERNSHIP': 'internship',
    }),
    ('question_banks', 'category'): ('questioncategory', {
        'TECHNICAL': 'technical', 'MANAGEMENT': 'management', 'HR': 'hr', 'OTHER': 'other',
    }),
    ('question_banks', 'difficulty'): ('questiondifficulty', {
        'JUNIOR': 'junior', 'INTERMEDIATE': 'intermediate', 'SENIOR': 'senior',
    }),
    ('resumes', 'screening_result'): ('screeningresult', {
        'PENDING': 'pending', 'PASSED': 'passed', 'REJECTED': 'rejected', 'WAITLIST': 'waitlist',
    }),
    ('resumes', 'status'): ('resumestatus', {
        'PENDING_SCREENING': 'pending_screening',
        'PENDING_REVIEW': 'pending_review',
        'PENDING_DEPT_REVIEW': 'pending_dept_review',
        'PENDING_HR_DECISION': 'pending_hr_decision',
        'AUTO_REJECTED_PENDING_REVIEW': 'auto_rejected_pending_review',
        'PENDING_INTERVIEW': 'pending_interview',
        'INTERVIEW_PASSED': 'interview_passed',
        'INTERVIEW_FAILED': 'interview_failed',
        'OFFER_PENDING': 'offer_pending',
        'OFFER_ACCEPTED': 'offer_accepted',
        'OFFER_REJECTED': 'offer_rejected',
        'ONBOARDING': 'onboarding',
        'COMPLETED': 'completed',
        'REJECTED': 'rejected',
        'WAITLIST': 'waitlist',
    }),
    ('interviews', 'result'): ('interviewresult', {
        'PENDING': 'pending', 'PASSED': 'passed', 'REJECTED': 'rejected', 'WAITLIST': 'waitlist',
        'HIRED': 'hired', 'NEXT_ROUND': 'next_round',
    }),
    ('interviews', 'status'): ('interviewstatus', {
        'SCHEDULED': 'scheduled', 'IN_PROGRESS': 'in_progress', 'ANALYZING': 'analyzing',
        'COMPLETED': 'completed', 'CANCELLED': 'cancelled',
    }),
    ('offers', 'status'): ('offerstatus', {
        'DRAFT': 'draft', 'PENDING': 'pending', 'SENT': 'sent',
        'ACCEPTED': 'accepted', 'REJECTED': 'rejected', 'EXPIRED': 'expired', 'WITHDRAWN': 'withdrawn',
    }),
    ('coding_tests', 'status'): ('codingteststatus', {
        'DRAFT': 'draft', 'PUBLISHED': 'published', 'CLOSED': 'closed',
    }),
    ('coding_submissions', 'status'): ('codingsubmissionstatus', {
        'DRAFT': 'draft', 'SUBMITTED': 'submitted', 'EVALUATED': 'evaluated',
    }),
}


def upgrade():
    # PostgreSQL requires new enum labels to be committed before they can be used in UPDATE.
    ctx = op.get_context()
    with ctx.autocommit_block():
        for enum_name, values in ENUM_VALUES.items():
            for value in values:
                op.execute(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{value}'")

    for (table, column), (enum_name, mapping) in DATA_NORMALIZATION.items():
        for old, new in mapping.items():
            op.execute(
                f"UPDATE {table} SET {column} = '{new}'::{enum_name} "
                f"WHERE {column}::text = '{old}'"
            )


def downgrade():
    pass
