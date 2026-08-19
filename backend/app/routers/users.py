import hashlib
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
AVATAR_DIR = UPLOADS_DIR / "avatars"
MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

REGISTERABLE_ROLES = {"engineer", "reviewer", "technician"}
AVATAR_PALETTE = ["#3ee6c4", "#7aa2ff", "#ff9d5c", "#c792ea", "#f4c95d", "#ff7a7a", "#5ce6a6", "#6fd0ff"]


def _avatar_color_for(seed: str) -> str:
    digest = hashlib.sha1(seed.encode()).hexdigest()
    return AVATAR_PALETTE[int(digest, 16) % len(AVATAR_PALETTE)]


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    return f"+1{digits[-10:]}" if len(digits) >= 10 else phone.strip()


@router.get("", response_model=list[schemas.UserOut])
def list_users(role: str | None = None, db: Session = Depends(get_db)):
    q = select(models.User)
    if role:
        q = q.where(models.User.role == role)
    return db.execute(q.order_by(models.User.name)).scalars().all()


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    return db.get(models.User, user_id)


@router.post("/register", response_model=schemas.UserOut)
def register(body: schemas.UserRegisterIn, db: Session = Depends(get_db)):
    role = body.role.strip().lower()
    if role not in REGISTERABLE_ROLES:
        raise HTTPException(422, f"Role must be one of {sorted(REGISTERABLE_ROLES)}")
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Name is required")
    if not body.site_ids:
        raise HTTPException(422, "Select at least one project to join")
    sites = [db.get(models.Site, sid) for sid in body.site_ids]
    if any(s is None for s in sites):
        raise HTTPException(404, "Unknown project")

    is_technician = role == "technician"
    if is_technician:
        if not body.phone or not body.phone.strip():
            raise HTTPException(422, "Phone is required for technicians")
        phone = _normalize_phone(body.phone)
        existing = db.execute(select(models.User).where(models.User.phone == phone)).scalars().first()
    else:
        if not body.email or not body.email.strip():
            raise HTTPException(422, "Email is required")
        email = body.email.strip().lower()
        existing = db.execute(
            select(models.User).where(func.lower(models.User.email) == email)
        ).scalars().first()

    if existing:
        # Signing up with an identity that already has an account joins the
        # new project(s) rather than erroring — the common real-world case
        # of an engineer already registered elsewhere being added to a site.
        merged = sorted(set(existing.site_ids or []) | set(body.site_ids))
        if merged != sorted(existing.site_ids or []):
            existing.site_ids = merged
            db.add(models.AuditEvent(
                id=models.gen_id(), site_id=body.site_ids[0], actor=existing.name,
                action="user_joined_project", detail=f"joined {len(body.site_ids)} project(s)",
            ))
            db.commit()
            db.refresh(existing)
        return existing

    user = models.User(
        id=models.gen_id(), org_id=sites[0].org_id, role=role, name=name,
        phone=_normalize_phone(body.phone) if is_technician else None,
        email=body.email.strip().lower() if not is_technician else None,
        discipline=(body.discipline or "").strip() or None,
        title=(body.title or "").strip() or None,
        avatar_color=_avatar_color_for(body.email or body.phone or name),
        site_ids=body.site_ids,
    )
    db.add(user)
    db.add(models.AuditEvent(
        id=models.gen_id(), site_id=body.site_ids[0], actor=name,
        action="user_registered", detail=f"{role} joined {len(body.site_ids)} project(s)",
    ))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.UserOut)
def login(body: schemas.UserLoginIn, db: Session = Depends(get_db)):
    role = body.role.strip().lower()
    identifier = body.identifier.strip()
    if not identifier:
        raise HTTPException(422, "Enter an email or phone number")
    if role == "technician":
        user = db.execute(
            select(models.User).where(
                models.User.role == "technician", models.User.phone == _normalize_phone(identifier)
            )
        ).scalars().first()
    else:
        user = db.execute(
            select(models.User).where(
                models.User.role.in_(["engineer", "reviewer"]), func.lower(models.User.email) == identifier.lower()
            )
        ).scalars().first()
    if not user:
        raise HTTPException(404, "No account found with that identifier — try creating one instead")
    return user


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
