import os
from datetime import datetime

import requests
from fastapi import APIRouter, HTTPException
from nanoid import generate
from passlib.context import CryptContext
from pydantic import BaseModel

from utils.auth import create_access_token

router = APIRouter()

COUCH_SERVER = os.getenv("COUCH_SERVER")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = (os.getenv("DB_PASSWORD"))
ADMIN_AUTH = (DB_USER, DB_PASSWORD)


print("COUCH_SERVER:", COUCH_SERVER)
print("DB_NAME:", DB_NAME)
print("DB_USER:", DB_USER)
print("DB_PASSWORD:", DB_PASSWORD)
print("ADMIN_AUTH:", ADMIN_AUTH)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    username: str  # phone number
    password: str  # PIN


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


def gen_id(prefix):
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


def find_user_by_phone(phone: str):
    search_query = {
        "selector": {
            "type": "user",
            "phone": phone,
        },
        "limit": 1,
    }

    res = requests.post(
        f"{COUCH_SERVER}/{DB_NAME}/_find",
        json=search_query,
        auth=ADMIN_AUTH,
    )

    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Database connection error")

    docs = res.json().get("docs", [])
    return docs[0] if docs else None


def save_user_doc(user_doc: dict):
    res = requests.put(
        f"{COUCH_SERVER}/{DB_NAME}/{user_doc['_id']}",
        json=user_doc,
        auth=ADMIN_AUTH,
    )

    if res.status_code not in (200, 201, 202):
        raise HTTPException(status_code=500, detail="Failed to update user")


@router.post("/login")
def login(data: LoginRequest):
    user_doc = find_user_by_phone(data.username)

    if not user_doc:
        return {"success": False, "error": "Invalid phone number or PIN"}

    pin_hash = user_doc.get("pin_hash")
    legacy_pin = user_doc.get("pin")

    valid = False

    if pin_hash:
        valid = verify_pin(data.password, pin_hash)
    elif legacy_pin is not None:
        valid = str(legacy_pin) == str(data.password)

        # Backward-compatible one-time migration: successful legacy login
        # replaces plaintext PIN with bcrypt hash.
        if valid:
            user_doc["pin_hash"] = hash_pin(data.password)
            user_doc.pop("pin", None)
            user_doc["updated_at"] = datetime.utcnow().isoformat()
            save_user_doc(user_doc)

    if not valid:
        return {"success": False, "error": "Invalid phone number or PIN"}

    token = user_doc.get("token") or create_access_token({"sub": data.username})

    if user_doc.get("token") != token:
        user_doc["token"] = token
        user_doc["updated_at"] = datetime.utcnow().isoformat()
        save_user_doc(user_doc)

    return {
        "success": True,
        "token": token,
        "workspace": DB_NAME,
        "user_session": {
            "id": user_doc["_id"],
            "name": f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip(),
            "access_rights": user_doc.get("access_rights") or user_doc.get("memberships") or [],
        },
    }


@router.post("/register")
@router.post("/register")
def register(data: RegisterRequest):
    try:
        print("\n========== REGISTER START ==========")

        now = datetime.utcnow().isoformat()

        print("Incoming payload:")
        print(data.dict())

        print("\nEnvironment:")
        print("COUCH_SERVER:", COUCH_SERVER)
        print("DB_NAME:", DB_NAME)
        print("ADMIN_AUTH:", ADMIN_AUTH)

        # =========================
        # CHECK EXISTING USER
        # =========================
        # existing_user = find_user_by_phone(data.phone)
        # print("Existing user:", existing_user)

        # if existing_user:
        #     return {
        #         "success": False,
        #         "error": "Phone number already registered"
        #     }

        # =========================
        # GENERATE IDS
        # =========================
        user_id = gen_id("user")
        workspace_id = gen_id("ws")
        membership_id = gen_id("mem")
        notif_id = gen_id("notif")

        print("\nGenerated IDs:")
        print("user_id:", user_id)
        print("workspace_id:", workspace_id)
        print("membership_id:", membership_id)
        print("notif_id:", notif_id)

        # =========================
        # TOKEN
        # =========================
        token = create_access_token({"sub": data.phone})

        print("\nToken generated successfully")

        # =========================
        # USER DOC
        # =========================
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
            "updated_at": None,
        }

        print("\nUser doc:")
        print(user_doc)

        # =========================
        # WORKSPACE
        # =========================
        if data.accountType == "team":
            workspace_name = data.workspaceName or "Team Workspace"
            workspace_desc = data.workspaceDesc or ""
        else:
            workspace_name = f"{data.first_name}'s Workspace"
            workspace_desc = "Personal workspace"

        workspace_doc = {
            "_id": workspace_id,
            "type": "workspace",
            "account_type": data.accountType,
            "name": workspace_name,
            "description": workspace_desc,
            "owner_id": user_id,
            "created_at": now,
        }

        print("\nWorkspace doc:")
        print(workspace_doc)

        # =========================
        # MEMBERSHIP
        # =========================
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

        print("\nMembership doc:")
        print(membership_doc)

        # =========================
        # NOTIFICATION
        # =========================
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

        print("\nNotification doc:")
        print(notification)

        # =========================
        # REQUEST
        # =========================
        request_url = f"{COUCH_SERVER}/{DB_NAME}/_bulk_docs"

        print("\nSending request to CouchDB...")
        print("URL:", request_url)

        payload = {
            "docs": [
                user_doc,
                workspace_doc,
                membership_doc,
                notification,
            ]
        }

        print("\nPayload:")
        print(payload)

        res = requests.post(
            request_url,
            json=payload,
            auth=ADMIN_AUTH,
        )

        print("\nCouchDB response:")
        print("Status:", res.status_code)
        print("Headers:", dict(res.headers))
        print("Body:", res.text)

        # =========================
        # RESPONSE CHECK
        # =========================
        if res.status_code not in (200, 201, 202):
            print("\nFAILED TO CREATE USER")
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Failed to create user",
                    "status": res.status_code,
                    "response": res.text,
                },
            )

        print("\nUSER CREATED SUCCESSFULLY")
        print("========== REGISTER END ==========\n")

        return {
            "success": True,
            "message": "User registered successfully",
            "token": token,
            "user_id": user_id,
            "db": DB_NAME,
            "workspace_id": workspace_id,
            "user": sanitize_user(user_doc),
        }

    except HTTPException:
        raise

    except Exception as e:
        import traceback

        print("\n========== REGISTER ERROR ==========")
        print("Error:", str(e))
        traceback.print_exc()
        print("====================================\n")

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

@router.post("/auth/verify-session")
def verify_session(body: VerifySessionBody):
    if not body.userId or not body.token:
        raise HTTPException(status_code=401, detail="Invalid session")

    search_query = {
        "selector": {
            "type": "user",
            "_id": body.userId,
            "token": body.token,
        },
        "limit": 1,
    }

    response = requests.post(
        f"{COUCH_SERVER}/{DB_NAME}/_find",
        json=search_query,
        auth=ADMIN_AUTH,
    )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="DB query failed")

    docs = response.json().get("docs", [])

    if not docs:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = docs[0]

    if user.get("is_deleted") is True:
        raise HTTPException(status_code=401, detail="User deleted")

    return {
        "success": True,
        "user": sanitize_user(user),
    }
