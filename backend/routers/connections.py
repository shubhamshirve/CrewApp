from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_current_user, _clean_user
from services.notifications_service import send_notification

router = APIRouter(prefix="/connections")


def _conn_to_dict(c: dict) -> dict:
    c = dict(c)
    if "_id" in c:
        c["id"] = str(c.pop("_id"))
    return c


@router.get("")
async def get_connections(current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["id"]
    conns = await db.connections.find({
        "$or": [{"requester_id": uid}, {"recipient_id": uid}],
        "status": "accepted"
    }).to_list(100)
    result = []
    for c in conns:
        c_dict = _conn_to_dict(c)
        other_id = c["recipient_id"] if c["requester_id"] == uid else c["requester_id"]
        other = await db.users.find_one({"_id": other_id}, {"password_hash": 0})
        c_dict["user"] = _clean_user(other) if other else None
        result.append(c_dict)
    return result


@router.get("/requests")
async def get_requests(current_user: dict = Depends(get_current_user)):
    db = get_db()
    received = await db.connections.find({"recipient_id": current_user["id"], "status": "pending"}).to_list(50)
    sent = await db.connections.find({"requester_id": current_user["id"], "status": "pending"}).to_list(50)
    received_enriched = []
    for c in received:
        d = _conn_to_dict(c)
        user = await db.users.find_one({"_id": c["requester_id"]}, {"password_hash": 0})
        d["user"] = _clean_user(user) if user else None
        received_enriched.append(d)
    sent_enriched = []
    for c in sent:
        d = _conn_to_dict(c)
        user = await db.users.find_one({"_id": c["recipient_id"]}, {"password_hash": 0})
        d["user"] = _clean_user(user) if user else None
        sent_enriched.append(d)
    return {"received": received_enriched, "sent": sent_enriched}


@router.post("/{user_id}")
async def send_request(user_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")
    target = await db.users.find_one({"_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.connections.find_one({
        "$or": [
            {"requester_id": current_user["id"], "recipient_id": user_id},
            {"requester_id": user_id, "recipient_id": current_user["id"]}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Connection already exists or pending")
    now = datetime.now(timezone.utc).isoformat()
    conn = {
        "_id": str(uuid.uuid4()),
        "requester_id": current_user["id"],
        "recipient_id": user_id,
        "status": "pending",
        "created_at": now,
    }
    await db.connections.insert_one(conn)
    await send_notification(
        db, user_id, "connection_request",
        "New Connection Request",
        f"{current_user['full_name']} wants to connect with you",
        {"connection_id": conn["_id"], "requester_id": current_user["id"]}
    )
    conn["id"] = conn.pop("_id")
    return conn


@router.put("/{conn_id}/accept")
async def accept_request(conn_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    conn = await db.connections.find_one({"_id": conn_id, "recipient_id": current_user["id"]})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found")
    await db.connections.update_one({"_id": conn_id}, {"$set": {"status": "accepted"}})
    await send_notification(
        db, conn["requester_id"], "connection_accepted",
        "Connection Accepted",
        f"{current_user['full_name']} accepted your connection request",
        {"connection_id": conn_id}
    )
    return {"status": "accepted"}


@router.put("/{conn_id}/reject")
async def reject_request(conn_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    conn = await db.connections.find_one({"_id": conn_id, "recipient_id": current_user["id"]})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found")
    await db.connections.update_one({"_id": conn_id}, {"$set": {"status": "rejected"}})
    return {"status": "rejected"}


@router.delete("/{conn_id}")
async def remove_connection(conn_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    conn = await db.connections.find_one({
        "_id": conn_id,
        "$or": [{"requester_id": current_user["id"]}, {"recipient_id": current_user["id"]}]
    })
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    await db.connections.delete_one({"_id": conn_id})
    return {"message": "Connection removed"}
