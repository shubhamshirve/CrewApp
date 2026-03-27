from fastapi import APIRouter, Depends
from db import get_db
from auth_utils import get_current_user

router = APIRouter(prefix="/notifications")


def _n_dict(n: dict) -> dict:
    n = dict(n)
    if "_id" in n:
        n["id"] = str(n.pop("_id"))
    return n


@router.get("")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    db = get_db()
    notifs = await db.notifications.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).limit(50).to_list(50)
    return [_n_dict(n) for n in notifs]


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    db = get_db()
    count = await db.notifications.count_documents({"user_id": current_user["id"], "is_read": False})
    return {"count": count}


@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.notifications.update_one(
        {"_id": notif_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}


@router.put("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}
