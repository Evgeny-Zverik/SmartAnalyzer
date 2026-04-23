from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.encryption import derive_transport_key
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserRead
from app.services.folders import ensure_user_system_folders

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ensure_user_system_folders(db, user.id)
    return UserRead(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        plan=user.plan,
    )


@router.post("/login")
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ACCOUNT_BLOCKED",
                "message": "Ваш аккаунт ограничен, напишите в поддержку",
            },
        )
    token = create_access_token(subject=str(user.id))
    tk = derive_transport_key(user.id)
    return {"access_token": token, "token_type": "bearer", "transport_key": tk}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    tk = derive_transport_key(current_user.id)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": str(current_user.created_at),
        "plan": current_user.plan,
        "transport_key": tk,
    }
