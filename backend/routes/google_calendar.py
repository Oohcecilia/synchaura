import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from routes.auth import get_authenticated_user

router = APIRouter(prefix="/google-calendar", tags=["google-calendar"])

COUCH_SERVER = os.getenv("COUCH_SERVER")
DB_NAME = os.getenv("DB_NAME")
ADMIN_AUTH = (os.getenv("COUCH_USER"), os.getenv("COUCH_PASS"))
JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY") or "dev-secret"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://synchaura.dpdns.org")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_API_ROOT = "https://www.googleapis.com/calendar/v3"
SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]
REQUEST_TIMEOUT = 15


class GoogleEventBody(BaseModel):
    calendar_id: str = "primary"
    summary: str
    description: Optional[str] = None
    location: Optional[str] = None
    start: str
    end: str
    all_day: bool = False


class GoogleEventUpdateBody(GoogleEventBody):
    pass


def couch_url(path: str) -> str:
    if not COUCH_SERVER or not DB_NAME:
        raise HTTPException(status_code=500, detail="CouchDB is not configured")
    return f"{COUCH_SERVER.rstrip('/')}/{DB_NAME}/{path.lstrip('/')}"


def couch_find(selector: dict, limit: int = 1):
    res = requests.post(
        couch_url("_find"),
        json={"selector": selector, "limit": limit},
        auth=ADMIN_AUTH,
        timeout=REQUEST_TIMEOUT,
    )
    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Database query failed")
    return res.json().get("docs", [])


def couch_put(doc: dict):
    res = requests.put(
        couch_url(doc["_id"]),
        json=doc,
        auth=ADMIN_AUTH,
        timeout=REQUEST_TIMEOUT,
    )
    if res.status_code not in (200, 201, 202):
        raise HTTPException(status_code=500, detail="Failed to save document")
    saved = res.json()
    doc["_rev"] = saved.get("rev", doc.get("_rev"))
    return doc


def couch_delete(doc: dict):
    res = requests.delete(
        couch_url(doc["_id"]),
        params={"rev": doc["_rev"]},
        auth=ADMIN_AUTH,
        timeout=REQUEST_TIMEOUT,
    )
    if res.status_code not in (200, 202):
        raise HTTPException(status_code=500, detail="Failed to delete document")


def require_google_config():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Google Calendar OAuth is not configured")


def get_current_user(request: Request):
    return get_authenticated_user(request)


def token_doc_id(user_id: str) -> str:
    return f"google_calendar_token_{user_id}"


def get_token_doc(user_id: str):
    docs = couch_find({"_id": token_doc_id(user_id), "type": "google_calendar_token"}, limit=1)
    return docs[0] if docs else None


def save_token_doc(user_id: str, payload: dict):
    existing = get_token_doc(user_id)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **(existing or {}),
        "_id": token_doc_id(user_id),
        "type": "google_calendar_token",
        "user_id": user_id,
        "access_token": payload.get("access_token") or existing.get("access_token") if existing else payload.get("access_token"),
        "refresh_token": payload.get("refresh_token") or existing.get("refresh_token") if existing else payload.get("refresh_token"),
        "scope": payload.get("scope") or existing.get("scope") if existing else payload.get("scope"),
        "token_type": payload.get("token_type") or "Bearer",
        "expires_at": int(time.time()) + int(payload.get("expires_in", 3600)) - 60,
        "updated_at": now,
        "created_at": existing.get("created_at") if existing else now,
    }
    return couch_put(doc)


def get_valid_access_token(user_id: str):
    doc = get_token_doc(user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Google Calendar is not connected")

    if doc.get("access_token") and int(doc.get("expires_at") or 0) > int(time.time()):
        return doc["access_token"]

    refresh_token = doc.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Google Calendar reconnect required")

    require_google_config()
    res = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=REQUEST_TIMEOUT,
    )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Google Calendar reconnect required")

    updated = save_token_doc(user_id, res.json())
    return updated["access_token"]


def google_request(user_id: str, method: str, path: str, **kwargs):
    token = get_valid_access_token(user_id)
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {token}"
    headers.setdefault("Content-Type", "application/json")
    res = requests.request(
        method,
        f"{GOOGLE_API_ROOT}{path}",
        headers=headers,
        timeout=REQUEST_TIMEOUT,
        **kwargs,
    )
    if res.status_code == 204:
        return {"success": True}
    if res.status_code >= 400:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    return res.json()


def build_google_event(body: GoogleEventBody):
    event = {
        "summary": body.summary,
        "description": body.description or "",
        "location": body.location or "",
    }
    if body.all_day:
        event["start"] = {"date": body.start[:10]}
        event["end"] = {"date": body.end[:10]}
    else:
        event["start"] = {"dateTime": body.start}
        event["end"] = {"dateTime": body.end}
    return event


@router.get("/status")
def status(request: Request):
    user = get_current_user(request)
    doc = get_token_doc(user["_id"])
    return {"connected": bool(doc), "connected_at": doc.get("created_at") if doc else None}


@router.get("/auth-url")
def auth_url(request: Request):
    require_google_config()
    user = get_current_user(request)
    state = jwt.encode(
        {
            "sub": user["_id"],
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return {"url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/callback")
def callback(code: str = Query(...), state: str = Query(...)):
    require_google_config()
    try:
        payload = jwt.decode(state, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing user")
    except (JWTError, ValueError):
        return RedirectResponse(f"{FRONTEND_URL}/calendar?googleCalendar=error")

    res = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=REQUEST_TIMEOUT,
    )
    if res.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/calendar?googleCalendar=error")

    save_token_doc(user_id, res.json())
    return RedirectResponse(f"{FRONTEND_URL}/calendar?googleCalendar=connected")


@router.post("/disconnect")
def disconnect(request: Request):
    user = get_current_user(request)
    doc = get_token_doc(user["_id"])
    if doc:
        couch_delete(doc)
    return {"success": True}


@router.get("/calendars")
def calendars(request: Request):
    user = get_current_user(request)
    data = google_request(user["_id"], "GET", "/users/me/calendarList")
    return {"calendars": data.get("items", [])}


@router.get("/events")
def events(
    request: Request,
    timeMin: str,
    timeMax: str,
    calendarIds: Optional[str] = None,
):
    user = get_current_user(request)
    calendars_to_fetch = [c.strip() for c in (calendarIds or "primary").split(",") if c.strip()]
    items = []
    for calendar_id in calendars_to_fetch:
        data = google_request(
            user["_id"],
            "GET",
            f"/calendars/{calendar_id}/events",
            params={
                "timeMin": timeMin,
                "timeMax": timeMax,
                "singleEvents": "true",
                "orderBy": "startTime",
                "maxResults": 2500,
            },
        )
        for item in data.get("items", []):
            item["calendarId"] = calendar_id
            items.append(item)
    return {"events": items}


@router.post("/events")
def create_event(request: Request, body: GoogleEventBody):
    user = get_current_user(request)
    data = google_request(
        user["_id"],
        "POST",
        f"/calendars/{body.calendar_id}/events",
        json=build_google_event(body),
    )
    data["calendarId"] = body.calendar_id
    return {"event": data}


@router.put("/events/{calendar_id}/{event_id}")
def update_event(request: Request, calendar_id: str, event_id: str, body: GoogleEventUpdateBody):
    user = get_current_user(request)
    data = google_request(
        user["_id"],
        "PUT",
        f"/calendars/{calendar_id}/events/{event_id}",
        json=build_google_event(body),
    )
    data["calendarId"] = calendar_id
    return {"event": data}


@router.delete("/events/{calendar_id}/{event_id}")
def delete_event(request: Request, calendar_id: str, event_id: str):
    user = get_current_user(request)
    google_request(user["_id"], "DELETE", f"/calendars/{calendar_id}/events/{event_id}")
    return {"success": True}
