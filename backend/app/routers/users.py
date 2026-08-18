from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(role: str | None = None, db: Session = Depends(get_db)):
    q = select(models.User)
    if role:
        q = q.where(models.User.role == role)
    return db.execute(q.order_by(models.User.name)).scalars().all()


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    return db.get(models.User, user_id)


@router.get("/sites/all")
def list_sites(db: Session = Depends(get_db)):
    sites = db.execute(select(models.Site)).scalars().all()
    return [{"id": s.id, "name": s.name, "org_id": s.org_id} for s in sites]
