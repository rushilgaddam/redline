from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/sources", response_model=list[schemas.KnowledgeSourceOut])
def list_sources(site_id: str | None = None, db: Session = Depends(get_db)):
    q = select(models.KnowledgeSource)
    if site_id:
        q = q.where(models.KnowledgeSource.site_id == site_id)
    return db.execute(q.order_by(models.KnowledgeSource.connected_at)).scalars().all()


@router.post("/sources", response_model=schemas.KnowledgeSourceOut)
def connect_source(body: schemas.KnowledgeSourceCreateIn, db: Session = Depends(get_db)):
    if not db.get(models.Site, body.site_id):
        raise HTTPException(404, "Unknown site")
    if not db.get(models.User, body.connected_by_user_id):
        raise HTTPException(404, "Unknown user")
    source = models.KnowledgeSource(
        id=models.gen_id(), site_id=body.site_id, type=body.type,
        display_name=body.display_name, connected_by_user_id=body.connected_by_user_id,
        status="connected",
    )
    db.add(source)
    db.add(models.AuditEvent(
        id=models.gen_id(), actor=body.connected_by_user_id, action="knowledge_source_connected",
        detail=f"{body.type}: {body.display_name}",
    ))
    db.commit()
    db.refresh(source)
    return source


@router.post("/sources/{source_id}/disconnect", response_model=schemas.KnowledgeSourceOut)
def disconnect_source(source_id: str, db: Session = Depends(get_db)):
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
def ingest_document(body: schemas.KnowledgeDocumentCreateIn, db: Session = Depends(get_db)):
    source = db.get(models.KnowledgeSource, body.source_id)
    if not source:
        raise HTTPException(404, "Unknown source")
    doc = models.KnowledgeDocument(
        id=models.gen_id(), source_id=source.id, site_id=source.site_id,
        title=body.title, author=body.author, occurred_at=body.occurred_at,
        content=body.content, keywords=body.keywords,
    )
    db.add(doc)
    db.add(models.AuditEvent(
        id=models.gen_id(), actor=body.author or "engineer", action="knowledge_document_ingested",
        detail=body.title[:200],
    ))
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/documents/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(models.KnowledgeDocument, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}
