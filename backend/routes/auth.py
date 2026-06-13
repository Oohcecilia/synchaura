import json
import threading
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from nanoid import generate
from passlib.context import CryptContext
from pydantic import BaseModel

from utils.auth import create_access_token

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "auth-store.json"
STORE_LOCK = threading.Lock()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    pin: str
    accountType: str
    workspaceName: str | None = None
    workspaceDesc: str | None = None


class VerifySessionBody(BaseModel):
    userId: str
    token: str


def gen_id(prefix: str) -> str:
    return f"{prefix}_{generate(size=12)}"


def hash_pin(pin: str) -> str:
    return pwd_context.hash(pin)


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        return pwd_context.verify(pin, pin_hash)
    except Exception:
        return False


def sanitize_user(user_doc: dict) -> dict:
    user = dict(user_doc)
    user.pop("pin", None)
    user.pop("pin_hash", None)
    user.pop("password", None)
    user.pop("token", None)
    return user


def _empty_store() -> dict:
    return {
        "users": [],
        "workspaces": [],
        "memberships": [],
        "notifications": [],
    }


def _load_store() -> dict:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not STORE_PATH.exists():
        store = _empty_store()
        _save_store(store)
        return store

    try:
        with STORE_PATH.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception:
        data = _empty_store()

    store = _empty_store()
    for key in store:
        value = data.get(key, [])
        store[key] = value if isinstance(value, list) else []
    return store


def _save_store(store: dict) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = STORE_PATH.with_suffix(".json.tmp")
    with tmp_path.open("w", encoding="utf-8") as handle:
        json.dump(store, handle, indent=2, ensure_ascii=True)
    tmp_path.replace(STORE_PATH)


def _store_mutation(mutator):
    with STORE_LOCK:
        store = _load_store()
        result = mutator(store)
        _save_store(store)
        return result


def _find_user(store: dict, *, phone: str | None = None, user_id: str | None = None):
    for user in store.get("users", []):
        if phone is not None and str(user.get("phone")) == str(phone):
            return user
        if user_id is not None and str(user.get("_id")) == str(user_id):
            return user
    return None


def _memberships_for_user(store: dict, user_id: str) -> list[dict]:
    memberships = []
    for item in store.get("memberships", []):
        if str(item.get("user_id")) != str(user_id):
            continue
        memberships.append({
            "workspace_id": item.get("workspace_id"),
            "role": item.get("role", "member"),
            "team_ids": item.get("team_ids", []),
        })
    return memberships


@router.post("/login")
def login(data: LoginRequest):
    with STORE_LOCK:
        store = _load_store()
        user_doc = _find_user(store, phone=data.username)

        if not user_doc:
            return {"success": False, "error": "Invalid phone number or PIN"}

        pin_hash = user_doc.get("pin_hash")
        legacy_pin = user_doc.get("pin")

        valid = False
        if pin_hash:
            valid = verify_pin(data.password, pin_hash)
        elif legacy_pin is not None:
            valid = str(legacy_pin) == str(data.password)
            if valid:
                user_doc["pin_hash"] = hash_pin(data.password)
                user_doc.pop("pin", None)
                user_doc["updated_at"] = datetime.utcnow().isoformat()

        if not valid:
            return {"success": False, "error": "Invalid phone number or PIN"}

        token = user_doc.get("token") or create_access_token({"sub": data.username})
        user_doc["token"] = token
        user_doc["updated_at"] = datetime.utcnow().isoformat()
        _save_store(store)

        user_session = {
            "id": user_doc["_id"],
            "name": f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip(),
            "access_rights": _memberships_for_user(store, user_doc["_id"]),
        }

        return {
            "success": True,
            "token": token,
            "workspace": "synchaura",
            "user_session": user_session,
        }


@router.post("/register")
def register(data: RegisterRequest):
    try:
        now = datetime.utcnow().isoformat()

        def create_registration(store: dict):
            existing_user = _find_user(store, phone=data.phone)
            if existing_user:
                raise HTTPException(status_code=409, detail="Phone number already registered")

            user_id = gen_id("user")
            workspace_id = gen_id("ws")
            membership_id = gen_id("mem")
            notif_id = gen_id("notif")
            token = create_access_token({"sub": data.phone})

            if data.accountType == "team":
                workspace_name = data.workspaceName or "Team Workspace"
                workspace_desc = data.workspaceDesc or ""
            else:
                workspace_name = f"{data.first_name}'s Workspace"
                workspace_desc = "Personal workspace"

            user_doc = {
                "_id": user_id,
                "type": "user",
                "first_name": data.first_name,
                "last_name": data.last_name,
                "full_name": f"{data.first_name} {data.last_name}",
                "phone": data.phone,
                "pin_hash": hash_pin(data.pin),
                "email": f"{data.phone}@app.local",
                "token": token,
                "created_at": now,
                "updated_at": now,
            }

            workspace_doc = {
                "_id": workspace_id,
                "type": "workspace",
                "account_type": data.accountType,
                "name": workspace_name,
                "description": workspace_desc,
                "owner_id": user_id,
                "created_at": now,
            }

            membership_doc = {
                "_id": membership_id,
                "type": "membership",
                "user_id": user_id,
                "workspace_id": workspace_id,
                "role": "owner",
                "team_ids": [],
                "user_ids": [],
                "created_at": now,
            }

            notification = {
                "_id": notif_id,
                "type": "notification",
                "category": "info",
                "title": "Welcome to your workspace",
                "message": f"Welcome {data.first_name} {data.last_name}! Your workspace is set up and ready to go!",
                "user_id": user_id,
                "created_by": "System",
                "read": [],
                "status": "Pending",
                "created_at": now,
            }

            store["users"].append(user_doc)
            store["workspaces"].append(workspace_doc)
            store["memberships"].append(membership_doc)
            store["notifications"].append(notification)

            return {
                "success": True,
                "message": "User registered successfully",
                "token": token,
                "user_id": user_id,
                "db": "synchaura",
                "workspace_id": workspace_id,
                "user": sanitize_user(user_doc),
            }

        return _store_mutation(create_registration)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/auth/verify-session")
def verify_session(body: VerifySessionBody):
    with STORE_LOCK:
        store = _load_store()
        user = _find_user(store, user_id=body.userId)

        if not user or user.get("token") != body.token:
            raise HTTPException(status_code=401, detail="Invalid session")

        if user.get("is_deleted") is True:
            raise HTTPException(status_code=401, detail="User deleted")

        return {
            "success": True,
            "user": sanitize_user(user),
        }
