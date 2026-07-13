from pydantic import BaseModel, Field
from models import Status
from datetime import datetime

class TopicCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)

class TopicRead(TopicCreate):
    id: int = Field(gt=0)

    class Config:
        from_attributes = True

class ProblemCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    topic_id: int = Field(gt=0)

class ProblemRead(ProblemCreate):
    id: int = Field(gt=0)

    class Config:
        from_attributes = True

class AttemptCreate(BaseModel):
    status: Status
    notes: str | None = None

    problem_id: int = Field(gt=0)

class AttemptRead(AttemptCreate):
    id: int = Field(gt=0)
    attempted_at: datetime

    class Config:
        from_attributes = True
