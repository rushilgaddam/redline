from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import auth
from ..services.assistant import answer_question

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/ask", response_model=schemas.AssistantAnswerOut)
def ask(
    body: schemas.AssistantAskIn, db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    # Answers are scoped to whoever the verified token says is asking, not
    # whoever the client claims — otherwise any technician-side client could
    # pass another engineer's id and read their routed-flag queue.
    auth.require_engineer(current_user)
    answer = answer_question(db, current_user, body.question, site_id=body.site_id)
    return schemas.AssistantAnswerOut(
        text=answer.text, flag_ids=answer.flag_ids, drawing_ids=answer.drawing_ids
    )
