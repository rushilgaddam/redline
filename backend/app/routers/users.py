import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
AVATAR_DIR = UPLOADS_DIR / "avatars"
MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


@router.get("", response_model=list[schemas.UserOut])
def list_users(role: str | None = None, db: Session = Depends(get_db)):
    q = select(models.User)
    if role:
        q = q.where(models.User.role == role)
    return db.execute(q.order_by(models.User.name)).scalars().all()


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    return db.get(models.User, user_id)


@router.post("/{user_id}/avatar", response_model=schemas.UserOut)
async def upload_avatar(user_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(422, f"Unsupported image type '{ext}'. Use PNG, JPG, WEBP, or GIF.")

    data = await file.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(413, "Image too large (max 5MB)")

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}{ext}"
    (AVATAR_DIR / filename).write_bytes(data)

    user.avatar_url = f"/uploads/avatars/{filename}"
    db.add(models.AuditEvent(
        id=models.gen_id(), actor=user.name, action="avatar_updated", detail=filename,
    ))
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}/avatar", response_model=schemas.UserOut)
def remove_avatar(user_id: str, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.avatar_url = None
    db.commit()
    db.refresh(user)
    return user


@router.get("/sites/all")
def list_sites(db: Session = Depends(get_db)):
    sites = db.execute(select(models.Site)).scalars().all()
    return [{"id": s.id, "name": s.name, "org_id": s.org_id} for s in sites]
