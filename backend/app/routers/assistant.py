from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.assistant import answer_question

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/ask", response_model=schemas.AssistantAnswerOut)
def ask(body: schemas.AssistantAskIn, db: Session = Depends(get_db)):
    engineer = db.get(models.User, body.engineer_id)
    if not engineer:
        raise HTTPException(404, "Unknown user")
    answer = answer_question(db, engineer, body.question, site_id=body.site_id)
    return schemas.AssistantAnswerOut(
        text=answer.text, flag_ids=answer.flag_ids, drawing_ids=answer.drawing_ids
    )
