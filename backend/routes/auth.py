import base64
import json
import os
import threading
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from nanoid import generate
from passlib.context import CryptContext
from pydantic import BaseModel
from jose import JWTError, jwt

from utils.auth import create_access_token

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "auth-store.json"
STORE_PATH = Path(os.getenv("AUTH_STORE_PATH") or DEFAULT_STORE_PATH)
if not STORE_PATH.is_absolute():
    STORE_PATH = (Path(__file__).resolve().parents[1] / STORE_PATH).resolve()
STORE_LOCK = threading.Lock()
JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY") or "dev-secret"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI") or "https://synchaura.dpdns.org/auth/google/callback"
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://synchaura.dpdns.org")
COUCH_SERVER = os.getenv("COUCH_SERVER")
DB_NAME = os.getenv("DB_NAME")
COUCH_USER = os.getenv("COUCH_USER")
COUCH_PASS = os.getenv("COUCH_PASS")
COUCH_AUTH = (COUCH_USER, COUCH_PASS) if COUCH_USER and COUCH_PASS else None
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_SCOPES = ["openid", "email", "profile"]


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    password: str
    accountType: str
    workspaceName: str | None = None
    workspaceDesc: str | None = None


class ChangePasswordRequest(BaseModel):
    userId: str
    token: str
    currentPassword: str | None = None
    newPassword: str


class VerifySessionBody(BaseModel):
    userId: str
    token: str


def gen_id(prefix: str) -> str:
    return f"{prefix}_{generate(size=12)}"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def sanitize_user(user_doc: dict) -> dict:
    user = dict(user_doc)
    user.pop("password", None)
    user.pop("password_hash", None)
    user.pop("pin", None)
    user.pop("pin_hash", None)
    user.pop("token", None)
    user.pop("memberships", None)
    user.pop("access_rights", None)
    return user


def _password_meets_policy(password: str) -> bool:
    if len(password) < 6:
        return False
    if password.isdigit():
        return False
    if password.lower() == password or password.upper() == password:
        return False
    return any(ch.isdigit() for ch in password) and any(not ch.isalnum() for ch in password)


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


def _find_user(
    store: dict,
    *,
    phone: str | None = None,
    email: str | None = None,
    user_id: str | None = None,
):
    for user in store.get("users", []):
        if phone is not None and str(user.get("phone")) == str(phone):
            return user
        if email is not None and str(user.get("email", "")).strip().lower() == str(email).strip().lower():
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


def _user_session(store: dict, user_doc: dict) -> dict:
    memberships = _memberships_for_user(store, user_doc["_id"])
    user = sanitize_user(user_doc)
    user["id"] = user_doc["_id"]
    user["_id"] = user_doc["_id"]
    return {
        "id": user_doc["_id"],
        "name": f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip(),
        "email": user_doc.get("email"),
        "memberships": memberships,
        "user": user,
    }


def _create_personal_workspace(store: dict, user_id: str, first_name: str, last_name: str, now: str) -> tuple[dict, dict]:
    workspace_id = gen_id("ws")
    membership_id = gen_id("mem")
    name_root = first_name or last_name or "Google User"
    workspace_doc = {
        "_id": workspace_id,
        "type": "workspace",
        "account_type": "personal",
        "name": f"{name_root}'s Workspace",
        "description": "Personal workspace",
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
    store["workspaces"].append(workspace_doc)
    store["memberships"].append(membership_doc)
    return workspace_doc, membership_doc


def _couch_base_url() -> str | None:
    if not COUCH_SERVER or not DB_NAME or not COUCH_AUTH:
        return None
    return f"{COUCH_SERVER.rstrip('/')}/{DB_NAME}"


def _couch_doc_url(doc_id: str) -> str | None:
    base = _couch_base_url()
    if not base:
        return None
    return f"{base}/{doc_id}"


def _couch_upsert(doc: dict) -> bool:
    if not doc.get("_id"):
        return False

    url = _couch_doc_url(doc["_id"])
    base = _couch_base_url()
    if not url or not base:
        return False

    try:
        existing = requests.get(url, auth=COUCH_AUTH, timeout=15)
        if existing.status_code == 200:
            doc = {**doc, "_rev": existing.json().get("_rev")}
        elif existing.status_code == 404:
            db_response = requests.put(base, auth=COUCH_AUTH, timeout=15)
            if db_response.status_code not in {200, 201, 202, 412}:
                db_response.raise_for_status()
        elif existing.status_code not in {200, 404}:
            existing.raise_for_status()

        save_response = requests.put(url, json=doc, auth=COUCH_AUTH, timeout=15)
        if save_response.status_code not in {200, 201, 202}:
            save_response.raise_for_status()
        return True
    except requests.RequestException as exc:
        print(f"[auth] CouchDB mirror failed for {doc.get('_id')}: {exc}")
        return False


def _mirror_account_to_couch(store: dict, user_doc: dict) -> None:
    user_id = user_doc.get("_id")
    if not user_id:
        return

    membership_docs = [
        membership
        for membership in store.get("memberships", [])
        if str(membership.get("user_id")) == str(user_id)
    ]
    memberships = _memberships_for_user(store, user_id)
    workspace_ids = {
        membership.get("workspace_id")
        for membership in membership_docs
        if membership.get("workspace_id")
    }
    workspace_docs = [
        workspace
        for workspace in store.get("workspaces", [])
        if str(workspace.get("_id")) in {str(workspace_id) for workspace_id in workspace_ids}
    ]
    notification_docs = [
        notification
        for notification in store.get("notifications", [])
        if str(notification.get("user_id")) == str(user_id)
    ]

    couch_user = sanitize_user(user_doc)
    couch_user["type"] = "user"
    couch_user["id"] = user_doc["_id"]
    couch_user["_id"] = user_doc["_id"]

    docs_to_sync = [couch_user, *workspace_docs]

    docs_to_sync.extend(membership_docs)

    docs_to_sync.extend(notification_docs)

    for doc in docs_to_sync:
        _couch_upsert(dict(doc))


def _mirror_account_to_couch_async(store: dict, user_doc: dict) -> None:
    snapshot_store = json.loads(json.dumps(store))
    snapshot_user = json.loads(json.dumps(user_doc))

    def runner():
        try:
            _mirror_account_to_couch(snapshot_store, snapshot_user)
        except Exception as exc:
            print(f"[auth] async couch mirror failed: {exc}")

    threading.Thread(target=runner, daemon=True).start()


def _build_oauth_redirect_url(payload: dict) -> str:
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).decode("ascii").rstrip("=")
    params = urlencode({"session": encoded})
    return f"{FRONTEND_URL}/auth/google/callback?{params}"


def _require_google_config():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")


def _get_google_profile(code: str) -> dict:
    _require_google_config()
    token_response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if token_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Google login failed")

    token_data = token_response.json()
    id_token = token_data.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Google login failed")

    profile_response = requests.get(
        GOOGLE_TOKENINFO_URL,
        params={"id_token": id_token},
        timeout=15,
    )
    if profile_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Google login failed")

    profile = profile_response.json()
    if profile.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google login failed")
    if str(profile.get("email_verified", "true")).lower() not in {"true", "1"}:
        raise HTTPException(status_code=400, detail="Google account email is not verified")

    return profile


def _find_google_user(store: dict, *, google_sub: str, email: str | None):
    for user in store.get("users", []):
        if google_sub and str(user.get("google_sub")) == str(google_sub):
            return user
        if email and str(user.get("email")) == str(email):
            return user
    return None


@router.post("/login")
def login(data: LoginRequest):
    print("LOGGING USER LOGIN.....")
    mirror_store = None
    mirror_user = None
    response = None
    with STORE_LOCK:
        store = _load_store()
        login_value = str(data.username).strip()
        user_doc = _find_user(
            store,
            phone=login_value,
            email=login_value.lower() if "@" in login_value else None,
        )

        if not user_doc:
            return {"success": False, "error": "Invalid email or phone number"}

        password_hash = user_doc.get("password_hash")
        legacy_pin_hash = user_doc.get("pin_hash")
        legacy_pin = user_doc.get("pin")

        valid = False
        is_legacy_credential = False
        if password_hash:
            valid = verify_password(data.password, password_hash)
        elif legacy_pin_hash:
            valid = verify_password(data.password, legacy_pin_hash)
            is_legacy_credential = valid
        elif legacy_pin is not None:
            valid = str(legacy_pin) == str(data.password)
            is_legacy_credential = valid

        if not valid:
            return {"success": False, "error": "Invalid email or phone number"}

        token = create_access_token({"sub": user_doc["_id"]})
        user_doc["token"] = token
        user_doc["updated_at"] = datetime.utcnow().isoformat()
        _save_store(store)
        mirror_store = store
        mirror_user = dict(user_doc)

        user_session = {
            "id": user_doc["_id"],
            "name": f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip(),
            "access_rights": _memberships_for_user(store, user_doc["_id"]),
        }

        response = {
            "success": True,
            "token": token,
            "workspace": "synchaura",
            "user_session": user_session,
            "memberships": _memberships_for_user(store, user_doc["_id"]),
            "must_change_password": bool(is_legacy_credential and not user_doc.get("password_hash")),
        }

    if mirror_store and mirror_user:
        _mirror_account_to_couch_async(mirror_store, mirror_user)

    return response


@router.post("/register")
def register(data: RegisterRequest):
    try:
        now = datetime.utcnow().isoformat()

        if not _password_meets_policy(data.password):
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters and include uppercase, lowercase, a number, and a symbol.",
            )

        def create_registration(store: dict):
            email = data.email.strip().lower()
            existing_user = _find_user(
                store,
                phone=data.phone,
                email=email if email else None,
            )
            if existing_user:
                raise HTTPException(status_code=409, detail="Email or phone number already registered")

            user_id = gen_id("user")
            workspace_id = gen_id("ws")
            membership_id = gen_id("mem")
            notif_id = gen_id("notif")
            token = create_access_token({"sub": user_id})

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
                "email": email,
                "password_hash": hash_password(data.password),
                "token": token,
                "created_at": now,
                "updated_at": now,
            }

            print(f"\n\n user document {user_doc} \n\n")

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
                "memberships": [membership_doc],
                "user": sanitize_user(user_doc),
            }

        result = _store_mutation(create_registration)

        print(f"\n\n result {result} \n\n")

        try:
            registered_store = _load_store()
            registered_user = _find_user(registered_store, user_id=result.get("user_id"))
            if registered_user:
                _mirror_account_to_couch_async(registered_store, registered_user)
        except Exception as exc:
            print(f"[auth] registration mirror skipped: {exc}")

        return result

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/auth/google/start")
def google_start(flow: str = "login"):
    _require_google_config()
    mode = "register" if flow == "register" else "login"
    state = jwt.encode(
        {
            "flow": mode,
            "iat": int(datetime.utcnow().timestamp()),
            "exp": int(datetime.utcnow().timestamp()) + 600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    params = urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "select_account",
            "include_granted_scopes": "true",
            "state": state,
        }
    )
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/auth/google/callback")
def google_callback(code: str = "", state: str = ""):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Google login failed")

    _require_google_config()

    try:
        payload = jwt.decode(state, JWT_SECRET, algorithms=["HS256"])
        flow = payload.get("flow", "login")
        if flow not in {"login", "register"}:
            flow = "login"
    except JWTError:
        raise HTTPException(status_code=400, detail="Google login failed")

    profile = _get_google_profile(code)
    google_sub = profile.get("sub")
    email = (profile.get("email") or "").strip().lower() or None
    first_name = profile.get("given_name") or ""
    last_name = profile.get("family_name") or ""
    full_name = profile.get("name") or f"{first_name} {last_name}".strip() or email or "Google User"
    picture = profile.get("picture")
    now = datetime.utcnow().isoformat()

    mirror_store = None
    mirror_user = None
    with STORE_LOCK:
        store = _load_store()
        user_doc = _find_google_user(store, google_sub=google_sub, email=email)
        is_new_user = user_doc is None

        if user_doc:
            user_doc.setdefault("created_at", now)
            user_doc["updated_at"] = now
            user_doc["first_name"] = first_name or user_doc.get("first_name") or full_name.split(" ")[0]
            user_doc["last_name"] = last_name or user_doc.get("last_name") or "User"
            user_doc["full_name"] = full_name
            user_doc["email"] = email or user_doc.get("email")
            user_doc["phone"] = user_doc.get("phone") or (email or google_sub)
            user_doc["auth_provider"] = "google"
            user_doc["google_sub"] = google_sub
            user_doc["google_email"] = email
            user_doc["google_picture"] = picture
        else:
            user_id = gen_id("user")
            user_doc = {
                "_id": user_id,
                "type": "user",
                "first_name": first_name or full_name.split(" ")[0] or "Google",
                "last_name": last_name or "User",
                "full_name": full_name,
                "phone": email or google_sub,
                "email": email,
                "auth_provider": "google",
                "google_sub": google_sub,
                "google_email": email,
                "google_picture": picture,
                "created_at": now,
                "updated_at": now,
            }
            _create_personal_workspace(store, user_doc["_id"], user_doc["first_name"], user_doc["last_name"], now)
            store["notifications"].append(
                {
                    "_id": gen_id("notif"),
                    "type": "notification",
                    "category": "info",
                    "title": "Welcome to your workspace",
                    "message": f"Welcome {full_name}! Your workspace is set up and ready to go!",
                    "user_id": user_doc["_id"],
                    "created_by": "System",
                    "read": [],
                    "status": "Pending",
                    "created_at": now,
                }
            )
            store["users"].append(user_doc)

        token = create_access_token({"sub": user_doc["_id"]})
        user_doc["token"] = token
        user_doc["updated_at"] = now

        _save_store(store)
        mirror_store = store
        mirror_user = dict(user_doc)

        session_payload = {
            "success": True,
            "token": token,
            "userId": user_doc["_id"],
            "is_new_user": is_new_user,
            "flow": flow,
            "user": _user_session(store, user_doc),
            "memberships": _memberships_for_user(store, user_doc["_id"]),
        }

    if mirror_store and mirror_user:
        _mirror_account_to_couch_async(mirror_store, mirror_user)

    return RedirectResponse(_build_oauth_redirect_url(session_payload))


@router.post("/auth/change-password")
def change_password(body: ChangePasswordRequest):
    if not _password_meets_policy(body.newPassword):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters and include uppercase, lowercase, a number, and a symbol.",
        )

    with STORE_LOCK:
        store = _load_store()
        user_doc = _find_user(store, user_id=body.userId)

        if not user_doc or user_doc.get("token") != body.token:
            raise HTTPException(status_code=401, detail="Invalid session")

        current_hash = user_doc.get("password_hash") or user_doc.get("pin_hash")
        current_pin = user_doc.get("pin")

        valid_current = False
        if current_hash:
            if not body.currentPassword:
                raise HTTPException(status_code=400, detail="Current password is required")
            valid_current = verify_password(body.currentPassword, current_hash)
        elif current_pin is not None:
            if not body.currentPassword:
                raise HTTPException(status_code=400, detail="Current password is required")
            valid_current = str(current_pin) == str(body.currentPassword)
        elif user_doc.get("auth_provider") == "google":
            valid_current = True

        if not valid_current:
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        user_doc["password_hash"] = hash_password(body.newPassword)
        user_doc.pop("pin_hash", None)
        user_doc.pop("pin", None)
        user_doc["updated_at"] = datetime.utcnow().isoformat()
        _save_store(store)

        return {
            "success": True,
            "user": sanitize_user(user_doc),
        }


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
