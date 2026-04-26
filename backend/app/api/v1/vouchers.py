from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.admin import require_admin
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.voucher import Voucher, VoucherRedemption
from app.services.usage import log_credit_transaction

router = APIRouter()


CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_code() -> str:
    parts = [
        "".join(secrets.choice(CODE_ALPHABET) for _ in range(4)) for _ in range(4)
    ]
    return "-".join(parts)


def _normalize_code(code: str) -> str:
    return code.strip().upper().replace(" ", "")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_voucher(v: Voucher, bound_email: str | None = None) -> dict:
    return {
        "id": v.id,
        "code": v.code,
        "credits": v.credits,
        "usage_limit": v.usage_limit,
        "used_count": v.used_count,
        "valid_from": v.valid_from.isoformat() if v.valid_from else None,
        "valid_until": v.valid_until.isoformat() if v.valid_until else None,
        "bound_user_id": v.bound_user_id,
        "bound_user_email": bound_email,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


# ---------------- Admin ----------------


class VoucherCreate(BaseModel):
    code: str | None = Field(default=None, max_length=64)
    credits: int = Field(..., ge=1, le=10_000_000)
    usage_limit: int = Field(default=1, ge=1, le=1_000_000)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    bound_user_email: str | None = Field(default=None, max_length=255)


@router.post("/admin/vouchers", status_code=201)
def create_voucher(
    payload: VoucherCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    code = _normalize_code(payload.code) if payload.code else _generate_code()
    if not code:
        raise HTTPException(status_code=400, detail="Код не может быть пустым")
    if len(code) > 64:
        raise HTTPException(status_code=400, detail="Код слишком длинный")

    if db.query(Voucher).filter(Voucher.code == code).first():
        raise HTTPException(status_code=409, detail="Код уже существует")

    if (
        payload.valid_from
        and payload.valid_until
        and payload.valid_until <= payload.valid_from
    ):
        raise HTTPException(
            status_code=400, detail="Конец действия должен быть позже начала"
        )

    bound_user_id: int | None = None
    bound_email: str | None = None
    if payload.bound_user_email:
        target_email = payload.bound_user_email.strip().lower()
        target = db.query(User).filter(User.email == target_email).first()
        if not target:
            raise HTTPException(
                status_code=404, detail=f"Пользователь {target_email} не найден"
            )
        bound_user_id = target.id
        bound_email = target.email

    voucher = Voucher(
        code=code,
        credits=int(payload.credits),
        usage_limit=int(payload.usage_limit),
        used_count=0,
        valid_from=payload.valid_from,
        valid_until=payload.valid_until,
        bound_user_id=bound_user_id,
        created_by_id=current_user.id,
    )
    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    return _serialize_voucher(voucher, bound_email)


@router.get("/admin/vouchers")
def list_vouchers(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Voucher, User.email)
        .outerjoin(User, User.id == Voucher.bound_user_id)
        .order_by(Voucher.created_at.desc())
        .all()
    )
    return {"items": [_serialize_voucher(v, email) for v, email in rows]}


@router.delete("/admin/vouchers/{voucher_id}", status_code=204)
def delete_voucher(
    voucher_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Ваучер не найден")
    db.delete(voucher)
    db.commit()
    return None


@router.get("/admin/vouchers/redemptions")
def list_redemptions(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(VoucherRedemption, Voucher.code, User.email)
        .join(Voucher, Voucher.id == VoucherRedemption.voucher_id)
        .join(User, User.id == VoucherRedemption.user_id)
        .order_by(VoucherRedemption.created_at.desc())
        .limit(500)
        .all()
    )
    return {
        "items": [
            {
                "id": r.id,
                "voucher_id": r.voucher_id,
                "code": code,
                "user_id": r.user_id,
                "user_email": email,
                "credits_granted": r.credits_granted,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r, code, email in rows
        ]
    }


# ---------------- User ----------------


class VoucherRedeem(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)


@router.post("/vouchers/redeem")
def redeem_voucher(
    payload: VoucherRedeem,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = _normalize_code(payload.code)
    if not code:
        raise HTTPException(status_code=400, detail="Введите код ваучера")

    voucher = (
        db.query(Voucher).filter(Voucher.code == code).with_for_update().first()
        if db.bind and db.bind.dialect.name != "sqlite"
        else db.query(Voucher).filter(Voucher.code == code).first()
    )
    if not voucher:
        raise HTTPException(status_code=404, detail="Ваучер не найден")

    now = _utc_now()
    if voucher.valid_from and now < voucher.valid_from:
        raise HTTPException(status_code=400, detail="Ваучер ещё не активен")
    if voucher.valid_until and now > voucher.valid_until:
        raise HTTPException(status_code=400, detail="Срок действия ваучера истёк")

    if voucher.bound_user_id and voucher.bound_user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Этот ваучер привязан к другому пользователю"
        )

    if voucher.used_count >= voucher.usage_limit:
        raise HTTPException(status_code=400, detail="Лимит активаций исчерпан")

    already = (
        db.query(VoucherRedemption)
        .filter(
            VoucherRedemption.voucher_id == voucher.id,
            VoucherRedemption.user_id == current_user.id,
        )
        .first()
    )
    if already:
        raise HTTPException(
            status_code=400, detail="Вы уже активировали этот ваучер"
        )

    voucher.used_count += 1
    db.add(
        VoucherRedemption(
            voucher_id=voucher.id,
            user_id=current_user.id,
            credits_granted=voucher.credits,
        )
    )
    log_credit_transaction(
        db,
        current_user,
        voucher.credits,
        "voucher_redeem",
        voucher.code,
    )
    db.commit()

    return {
        "credits_granted": voucher.credits,
        "credit_balance": current_user.credit_balance,
        "code": voucher.code,
    }
