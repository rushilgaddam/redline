from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import auth

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/sources", response_model=list[schemas.KnowledgeSourceOut])
def list_sources(site_id: str | None = None, db: Session = Depends(get_db)):
    q = select(models.KnowledgeSource)
    if site_id:
        q = q.where(models.KnowledgeSource.site_id == site_id)
    return db.execute(q.order_by(models.KnowledgeSource.connected_at)).scalars().all()


@router.post("/sources", response_model=schemas.KnowledgeSourceOut)
def connect_source(
    body: schemas.KnowledgeSourceCreateIn, db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    auth.require_engineer(current_user)
    if not db.get(models.Site, body.site_id):
        raise HTTPException(404, "Unknown site")
    # Connecting a source grants *this session's* engineer access, verified
    # by their token — not whatever connected_by_user_id the client sends.
    if body.connected_by_user_id != current_user.id and current_user.role not in ("reviewer", "admin"):
        raise HTTPException(403, "Can only connect a source as yourself")
    # Never blanket access — an Outlook/Teams source must name at least one
    # specific label/folder/channel it's allowed to read. "manual" sources
    # have nothing to scope (the engineer is the content), so they're exempt.
    if body.type != "manual" and not body.scope_items:
        raise HTTPException(422, "Specify at least one label, folder, or channel to grant access to")

    source = models.KnowledgeSource(
        id=models.gen_id(), site_id=body.site_id, type=body.type,
        display_name=body.display_name, connected_by_user_id=current_user.id,
        status="connected", scope_kind=body.scope_kind, scope_items=body.scope_items,
    )
    db.add(source)
    db.add(models.AuditEvent(
        id=models.gen_id(), site_id=body.site_id, actor=current_user.name, action="knowledge_source_connected",
        detail=f"{body.type}: {body.display_name} (scope: {', '.join(body.scope_items) or 'n/a'})",
    ))
    db.commit()
    db.refresh(source)
    return source


@router.post("/sources/{source_id}/scope", response_model=schemas.KnowledgeSourceOut)
def add_scope_item(
    source_id: str, body: schemas.KnowledgeSourceScopeAddIn, db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    auth.require_engineer(current_user)
    source = db.get(models.KnowledgeSource, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    item = body.item.strip()
    if not item:
        raise HTTPException(422, "Item is required")
    if item not in (source.scope_items or []):
        source.scope_items = [*(source.scope_items or []), item]
        db.add(models.AuditEvent(
            id=models.gen_id(), site_id=source.site_id, actor=current_user.name,
            action="knowledge_scope_granted", detail=f"{source.display_name}: +{item}",
        ))
        db.commit()
        db.refresh(source)
    return source


@router.post("/sources/{source_id}/disconnect", response_model=schemas.KnowledgeSourceOut)
def disconnect_source(
    source_id: str, db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    auth.require_engineer(current_user)
    source = db.get(models.KnowledgeSource, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    source.status = "disconnected"
    db.commit()
    db.refresh(source)
    return source


@router.get("/documents", response_model=list[schemas.KnowledgeDocumentOut])
def list_documents(site_id: str | None = None, source_id: str | None = None, db: Session = Depends(get_db)):
    q = select(models.KnowledgeDocument)
    if site_id:
        q = q.where(models.KnowledgeDocument.site_id == site_id)
    if source_id:
        q = q.where(models.KnowledgeDocument.source_id == source_id)
    return db.execute(q.order_by(models.KnowledgeDocument.created_at.desc())).scalars().all()


@router.get("/documents/{document_id}", response_model=schemas.KnowledgeDocumentOut)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(models.KnowledgeDocument, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.post("/documents", response_model=schemas.KnowledgeDocumentOut)
def ingest_document(
    body: schemas.KnowledgeDocumentCreateIn, db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    auth.require_engineer(current_user)
    source = db.get(models.KnowledgeSource, body.source_id)
    if not source:
        raise HTTPException(404, "Unknown source")
    doc = models.KnowledgeDocument(
        id=models.gen_id(), source_id=source.id, site_id=source.site_id,
        title=body.title, author=body.author or current_user.name, occurred_at=body.occurred_at,
        content=body.content, keywords=body.keywords,
    )
    db.add(doc)
    db.add(models.AuditEvent(
        id=models.gen_id(), site_id=source.site_id, actor=current_user.name,
        action="knowledge_document_ingested", detail=body.title[:200],
    ))
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str, db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    auth.require_engineer(current_user)
    doc = db.get(models.KnowledgeDocument, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}
