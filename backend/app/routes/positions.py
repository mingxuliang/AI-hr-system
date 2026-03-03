from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.schemas.position import PositionCreate, PositionUpdate, PositionResponse
from app.services.position_service import (
    create_position, get_positions, get_position, update_position, delete_position
)
from typing import List
from uuid import UUID

router = APIRouter(
    prefix="/positions",
    tags=["positions"]
)

@router.post("", response_model=PositionResponse)
def create_position_route(position: PositionCreate, db: Session = Depends(get_db)):
    return create_position(db, position)

@router.get("", response_model=List[PositionResponse])
def get_positions_route(skip: int = 0, limit: int = 100, status: str = None, title: str = None, db: Session = Depends(get_db)):
    return get_positions(db, skip=skip, limit=limit, status=status, title=title)

@router.get("/public", response_model=List[PositionResponse])
def get_public_positions_route(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_positions(db, skip=skip, limit=limit, status="published")

@router.get("/{position_id}", response_model=PositionResponse)
def get_position_route(position_id: UUID, db: Session = Depends(get_db)):
    position = get_position(db, position_id)
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    return position

@router.put("/{position_id}", response_model=PositionResponse)
def update_position_route(position_id: UUID, position: PositionUpdate, db: Session = Depends(get_db)):
    db_position = update_position(db, position_id, position)
    if not db_position:
        raise HTTPException(status_code=404, detail="Position not found")
    return db_position

@router.delete("/{position_id}", response_model=PositionResponse)
def delete_position_route(position_id: UUID, db: Session = Depends(get_db)):
    db_position = delete_position(db, position_id)
    if not db_position:
        raise HTTPException(status_code=404, detail="Position not found")
    return db_position
