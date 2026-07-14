from fastapi import FastAPI, Depends, status, Path, Query,HTTPException
# from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, Base, engine
import models
from schemas import *
from typing import Annotated

# for deployment
from fastapi.staticfiles import StaticFiles


Base.metadata.create_all(bind = engine)

app = FastAPI()


# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],      # Allow all origins (good for development)
#     allow_credentials=False,
#     allow_methods=["*"],      # Allow GET, POST, PUT, DELETE, etc.
#     allow_headers=["*"],      # Allow all headers
# )

@app.get("/health/db")
def check_db(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1"))
    return {"db_status": "connected", "result": result.scalar()}


# Topic routes
@app.post('/topics', response_model= TopicRead, status_code=status.HTTP_201_CREATED)
def create_topic(topic: TopicCreate ,db: Session = Depends(get_db)):
    new_topic = models.Topic(**topic.model_dump())
    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    return new_topic

@app.get('/topics', response_model=list[TopicRead], status_code=status.HTTP_200_OK)
def get_all_topics(db: Session = Depends(get_db)):
    topics = db.query(models.Topic).all()
    return topics

@app.get('/topics/{topic_id}', response_model=TopicRead, status_code=status.HTTP_200_OK)
def get_a_topic(topic_id: Annotated[int, Path(gt=0)], db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return topic

@app.put('/topics/{topic_id}', response_model= TopicRead)
def update_topic(topic_id: Annotated[int, Path(gt=0)],topic: TopicCreate, db: Session = Depends(get_db)):
    org_topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not org_topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    org_topic.name = topic.name # type: ignore
    db.commit()
    return org_topic

@app.delete('/topics/{topic_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: Annotated[int, Path(gt=0)],db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    child = db.query(models.Problem).filter(models.Problem.topic_id == topic_id).first()

    if child:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Cannot delete topic: problems still reference it')       
    
    db.delete(topic)
    db.commit()

    return 


# Problems routes

@app.post('/problems', response_model=ProblemRead, status_code=status.HTTP_201_CREATED)
def create_problem(problem: ProblemCreate, db:Session = Depends(get_db)):
    topic_id = problem.topic_id
    if not db.query(models.Topic).filter(models.Topic.id == topic_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    new_problem = models.Problem(**problem.model_dump())
    db.add(new_problem)
    db.commit()
    db.refresh(new_problem)

    return new_problem



@app.get('/problems', response_model=list[ProblemRead])
def get_problems(topic_id: Annotated[int| None, Query(gt=0)] = None, db: Session = Depends(get_db)):
    if topic_id is None:
        return db.query(models.Problem).all()
    else:
        if not db.query(models.Topic).filter(models.Topic.id == topic_id).first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='this topic id does not exist')
        return db.query(models.Problem).filter(models.Problem.topic_id == topic_id).all()
    
@app.get('/problems/{prob_id}',response_model=ProblemRead)
def get_a_problem(prob_id: Annotated[int, Path(gt=0)], db:Session = Depends(get_db)):

    problem = db.query(models.Problem).filter(models.Problem.id == prob_id).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return problem

@app.put('/problems/{prob_id}', response_model=ProblemRead)
def update_problem(prob_id: Annotated[int, Path(gt=0)],problem: ProblemCreate ,db:Session = Depends(get_db)):
    org_problem = db.query(models.Problem).filter(models.Problem.id == prob_id).first()
    if not org_problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    for field, value in problem.model_dump().items():
        setattr(org_problem, field, value)
    db.commit()
    return org_problem

@app.delete('/problems/{prob_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_problem(prob_id: Annotated[int, Path(gt=0)], db:Session = Depends(get_db)):

    org_problem = db.query(models.Problem).filter(models.Problem.id == prob_id).first()
    if not org_problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    child = db.query(models.Attempt).filter(models.Attempt.problem_id == prob_id).first()
    if child:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Cannot delete problem: attempts still reference it') 

    db.delete(org_problem)
    db.commit()

    return       
        

# Attempt routes

@app.post('/attempts', status_code=status.HTTP_201_CREATED, response_model=AttemptRead)
def create_attempt(attempt: AttemptCreate, db:Session = Depends(get_db)):
    prob_id = attempt.problem_id
    if not db.query(models.Problem).filter(models.Problem.id == prob_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    new_attempt = models.Attempt(**attempt.model_dump())
    db.add(new_attempt)
    db.commit()
    db.refresh(new_attempt)

    return new_attempt

@app.get('/attempts', response_model = list[AttemptRead])
def get_attempts(prob_id: Annotated[int|None , Query(gt=0)] = None, db:Session = Depends(get_db)):
    if prob_id is None:
        return db.query(models.Attempt).all()
    else:
        if not db.query(models.Problem).filter(models.Problem.id == prob_id).first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        
        return db.query(models.Attempt).filter(models.Attempt.problem_id == prob_id).all()

@app.get('/attempts/{attempt_id}', response_model=AttemptRead)
def get_an_attempt(attempt_id: Annotated[int, Path(gt=0)], db: Session = Depends(get_db)):

    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return attempt

@app.put('/attempts/{attempt_id}', response_model=AttemptRead)
def update_attempt(attempt_id: Annotated[int, Path(gt=0)], attempt: AttemptCreate, db: Session = Depends(get_db)):
    org_attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not org_attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    for field, value in attempt.model_dump().items():
        setattr(org_attempt, field, value)
    
    db.commit()

    return org_attempt

@app.delete('/attempts/{attempt_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_attempt(attempt_id: Annotated[int, Path(gt=0)], db:Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    db.delete(attempt)
    db.commit()

    return

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")


