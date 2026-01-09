from sqlalchemy.orm import Session
from app.models import Permission
from app.api.v1.endpoints.roles import CORE_PERMISSIONS


def init_permissions(db: Session) -> None:
    """Initialize core system permissions if they don't exist."""
    for permission_name in CORE_PERMISSIONS:
        # Check if permission already exists
        existing_permission = (
            db.query(Permission).filter(Permission.name == permission_name).first()
        )

        if not existing_permission:
            # Create the permission
            new_permission = Permission(name=permission_name)
            db.add(new_permission)

    db.commit()
