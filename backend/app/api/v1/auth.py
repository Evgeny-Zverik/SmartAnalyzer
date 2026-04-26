from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
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
from app.services.email import send_password_reset_email
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
        credit_balance=user.credit_balance,
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


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


def _create_password_reset_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=app_settings.password_reset_token_minutes
    )
    payload = {"sub": str(user_id), "purpose": "password_reset", "exp": expire}
    return jwt.encode(
        payload, app_settings.jwt_secret, algorithm=app_settings.jwt_algorithm
    )


def _verify_password_reset_token(token: str) -> int:
    try:
        payload = jwt.decode(
            token,
            app_settings.jwt_secret,
            algorithms=[app_settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка недействительна или истекла",
        )
    if payload.get("purpose") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный токен",
        )
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный токен",
        )


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(body: ForgotPasswordBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user and not user.is_blocked:
        token = _create_password_reset_token(user.id)
        base = app_settings.app_public_url.rstrip("/")
        reset_url = f"{base}/reset-password?token={token}"
        send_password_reset_email(user.email, reset_url)
    return None


@router.post("/reset-password")
def reset_password(body: ResetPasswordBody, db: Session = Depends(get_db)):
    user_id = _verify_password_reset_token(body.token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь не найден",
        )
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ACCOUNT_BLOCKED",
                "message": "Ваш аккаунт ограничен, напишите в поддержку",
            },
        )
    user.password_hash = hash_password(body.password)
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    tk = derive_transport_key(current_user.id)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": str(current_user.created_at),
        "plan": current_user.plan,
        "credit_balance": current_user.credit_balance,
        "transport_key": tk,
    }
