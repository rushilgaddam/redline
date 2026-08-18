"""Routing Engine (architecture §4 step 7, §2 backup/coverage)."""
from sqlalchemy.orm import Session

from .. import models


def route_flag(db: Session, drawing: models.Drawing) -> tuple[str, bool]:
    """Returns (routed_to_user_id, used_backup)."""
    primary = db.get(models.User, drawing.primary_author_id)
    if primary and not primary.out_of_office:
        return primary.id, False

    for backup_id in drawing.backup_author_ids or []:
        backup = db.get(models.User, backup_id)
        if backup and not backup.out_of_office:
            return backup.id, True

    return drawing.primary_author_id, False
