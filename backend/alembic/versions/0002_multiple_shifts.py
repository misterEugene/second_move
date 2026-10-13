"""несколько смен одного мероприятия у волонтёра

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-13 09:00:00
"""
from collections.abc import Sequence

from alembic import op


revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint('applications_event_volunteer_key', 'applications', type_='unique')
    op.create_unique_constraint('applications_volunteer_shift_key', 'applications', ['volunteer_id', 'shift_id'])


def downgrade() -> None:
    op.drop_constraint('applications_volunteer_shift_key', 'applications', type_='unique')
    op.create_unique_constraint('applications_event_volunteer_key', 'applications', ['event_id', 'volunteer_id'])
