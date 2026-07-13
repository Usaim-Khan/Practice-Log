from database import Base
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum
from datetime import datetime, timezone

class Status(str,Enum):
    COMPLETED = 'completed'
    ATTEMPTED = 'attempted'
    FAILED = 'failed'

class Topic(Base):
    __tablename__ = 'topics'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)

    problems = relationship('Problem', back_populates='topic') # $$$ connects to

class Problem(Base):
    __tablename__ = 'problems'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    topic_id = Column(Integer, ForeignKey('topics.id'), nullable=False)

    topic = relationship('Topic', back_populates='problems') # $$$ this line
    attempts = relationship('Attempt', back_populates='problem')

class Attempt(Base):
    __tablename__ = 'attempts'

    id = Column(Integer, primary_key=True)
    status = Column(SQLEnum(Status), nullable=False)
    notes = Column(String, nullable=True)
    attempted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),nullable=False) # help!
    problem_id = Column(Integer,ForeignKey('problems.id'),nullable=False)
    
    problem = relationship('Problem', back_populates='attempts')