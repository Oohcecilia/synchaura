import requests
from nanoid import generate
from datetime import datetime
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from utils.auth import create_access_token
from pydantic import BaseModel
from fastapi import status
import os


router = APIRouter()

# 1. AUTH & SERVER CONFIG
# Use the root URL here to avoid double-pathing bugs
COUCH_SERVER = os.getenv("COUCH_SERVER")
DB_NAME = os.getenv("DB_NAME")
ADMIN_AUTH = (os.getenv("COUCH_USER"), os.getenv("COUCH_PASS"))


# -------------------------
# MODELS
# -------------------------
class LoginRequest(BaseModel):
    username: str # This is the phone number
    password: str # This is the pin



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

# -------------------------
# HELPERS
# -------------------------

def gen_id(prefix):
    return f"{prefix}_{generate(size=12)}"  # short + unique


# -------------------------
# ROUTES
# -------------------------

@router.post("/login")
def login(data: LoginRequest):
    # 1. Search for a document that matches Type, Phone, and Pin
    search_query = {
        "selector": {
            "type": "user",
            "phone": data.username,
            "pin": data.password
        },
        "limit": 1
    }

    res = requests.post(
        f"{COUCH_SERVER}/{DB_NAME}/_find",
        json=search_query,
        auth=ADMIN_AUTH
    )

    if res.status_code != 200:
        return {"success": False, "error": "Database connection error"}

    docs = res.json().get("docs", [])

    if not docs:
        return {"success": False, "error": "Invalid phone number or PIN"}

    # 2. Return the matching user data and token
    user_doc = docs[0]

    return {
        "success": True,
        "token": user_doc["token"],
        "workspace": DB_NAME,
        "user_session": {
            "id": user_doc["_id"],
            "name": f"{user_doc['first_name']} {user_doc['last_name']}",
            "access_rights": user_doc.get("access_rights")
        }
    }




@router.post("/register")
def register(data: RegisterRequest):
    try:
        now = datetime.utcnow().isoformat()

        # =========================
        # CHECK EXISTING USER
        # =========================
        check_query = {
            "selector": {"type": "user", "phone": data.phone},
            "limit": 1
        }

        check_res = requests.post(
            f"{COUCH_SERVER}/{DB_NAME}/_find",
            json=check_query,
            auth=ADMIN_AUTH
        )

        if check_res.json().get("docs"):
            return {"success": False, "error": "Phone number already registered"}

        # =========================
        # IDS
        # =========================
        user_id = gen_id("user")
        workspace_id = gen_id("ws")
        membership_id = gen_id("mem")
        notif_id = gen_id("notif")

                # TOKEN
        # =========================
        token = create_access_token({
            "sub": data.phone
        })

        # =========================
        # USER
        # =========================
        user_doc = {
            "_id": user_id,
            "type": "user",
            "first_name": data.first_name,
            "last_name": data.last_name,
            "full_name": f"{data.first_name} {data.last_name}",
            "phone": data.phone,
            "pin": data.pin,  # ⚠️ consider hashing later
            "email": f"{data.phone}@app.local",
            "token": token,
            "created_at": now,
            "updated_at": None
        }

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
            "created_at": now
        }

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
            "created_at": now
        }

        # =========================
        # NOTIFICATION
        # =========================
        notification = {
            "_id": notif_id,
            "type": "info",
            "title": "Welcome to your workspace",
            "message": f"Welcome {data.first_name} {data.last_name}! Your workspace is set up and ready to go!",
            "user_id": user_id,
            "created_by": "System",
            "created_at": now
        }

        # =========================
        # BULK INSERT
        # =========================
        docs = [user_doc, workspace_doc, membership_doc, notification]
        bulk_payload = {
            "docs": docs
        }

        res = requests.post(
            f"{COUCH_SERVER}/{DB_NAME}/_bulk_docs",
            json=bulk_payload,
            auth=ADMIN_AUTH
        )

        results = res.json()


        return {
            "success": True,
            "message": "User registered successfully",
            "token": token,
            "user_id": user_id,
            "db": DB_NAME,
            "workspace_id": workspace_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class VerifySessionBody(BaseModel):
    userId: str
    token: str


@router.post("/auth/verify-session")
def verify_session(body: VerifySessionBody):

    if not body.userId or not body.token:
        raise HTTPException(status_code=401, detail="Invalid session")

    search_query = {
        "selector": {
            "type": "user",
            "_id": body.userId,
            "token": body.token
        },
        "limit": 1
    }

    # 🔥 Make request
    response = requests.post(
        f"{COUCH_SERVER}/{DB_NAME}/_find",
        json=search_query,
        auth=ADMIN_AUTH
    )

    # -------------------------
    # 1. Check HTTP response
    # -------------------------
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="DB query failed")

    data = response.json()
    docs = data.get("docs", [])

    # -------------------------
    # 2. Check if user exists
    # -------------------------
    if not docs:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = docs[0]

    # -------------------------
    # 3. Extra safety checks
    # -------------------------
    if user.get("is_deleted") is True:
        raise HTTPException(status_code=401, detail="User deleted")

    # -------------------------
    # 4. Clean sensitive fields
    # -------------------------
    user.pop("password", None)
    user.pop("token", None)

    return {
        "success": True,
        "user": user
    }

