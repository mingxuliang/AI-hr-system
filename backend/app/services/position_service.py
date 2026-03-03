from sqlalchemy.orm import Session
from app.models.models import Position
from app.schemas.position import PositionCreate, PositionUpdate
from app.models.models import Position, PositionStatus
from uuid import UUID

def create_position(db: Session, position: PositionCreate):
    db_position = Position(**position.dict())
    db.add(db_position)
    db.commit()
    db.refresh(db_position)
    return db_position

def get_positions(db: Session, skip: int = 0, limit: int = 100, status: str = None, title: str = None):
    query = db.query(Position)
    if status:
        query = query.filter(Position.status == status)
    if title:
        query = query.filter(Position.title.ilike(f"%{title}%"))
    return query.order_by(Position.created_at.desc()).offset(skip).limit(limit).all()

def get_position(db: Session, position_id: UUID):
    return db.query(Position).filter(Position.id == position_id).first()

def update_position(db: Session, position_id: UUID, position: PositionUpdate):
    db_position = db.query(Position).filter(Position.id == position_id).first()
    if not db_position:
        return None
    
    update_data = position.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_position, key, value)
    
    db.commit()
    db.refresh(db_position)
    return db_position

def delete_position(db: Session, position_id: UUID):
    db_position = db.query(Position).filter(Position.id == position_id).first()
    if not db_position:
        return None
    
    db.delete(db_position)
    db.commit()
    return db_position
