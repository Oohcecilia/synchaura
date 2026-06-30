import json
import os
from urllib.parse import urljoin

import requests
from fastapi import APIRouter, HTTPException, Request, Response
from routes.auth import get_authenticated_user

router = APIRouter(prefix="/couch", tags=["couch-proxy"])

COUCH_SERVER = os.getenv("COUCH_SERVER")
DB_NAME = os.getenv("DB_NAME")
ADMIN_AUTH = (os.getenv("COUCH_USER"), os.getenv("COUCH_PASS"))

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
}


def build_couch_url(path: str) -> str:
    if not COUCH_SERVER or not DB_NAME:
        raise HTTPException(status_code=500, detail="CouchDB is not configured")

    base = f"{COUCH_SERVER.rstrip('/')}/{DB_NAME}/"
    return urljoin(base, path.lstrip("/"))


@router.api_route("", methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"])
@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"])
async def proxy_couch(request: Request, path: str = ""):
    # PouchDB uses several DB-relative endpoints during replication, such as
    # _changes, _bulk_get, _bulk_docs, _revs_diff, and document ids.
    method = request.method
    body = await request.body()

    if method == "OPTIONS":
        return Response(status_code=204)

    user = get_authenticated_user(request)
    user_id = user.get("_id") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    if method == "DELETE":
        raise HTTPException(status_code=405, detail="CouchDB document deletion is not allowed through the sync proxy")

    if path.startswith("_") and path.split("/", 1)[0] not in {
        "_all_docs",
        "_bulk_docs",
        "_bulk_get",
        "_changes",
        "_find",
        "_local",
        "_revs_diff",
    }:
        raise HTTPException(status_code=403, detail="CouchDB endpoint is not allowed through the sync proxy")

    if method in {"POST", "PUT"} and body:
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            payload = None

        docs = payload.get("docs") if isinstance(payload, dict) else None
        if isinstance(docs, list):
            for doc in docs:
                if isinstance(doc, dict) and not doc.get("_deleted"):
                    doc.setdefault("user_id", user_id)
            body = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    url = build_couch_url(path)

    query_string = request.url.query
    if query_string:
      url = f"{url}?{query_string}"

    forwarded_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
        and key.lower() not in {"host", "authorization"}
    }

    try:
        upstream = requests.request(
            method,
            url,
            data=body if body else None,
            headers=forwarded_headers,
            auth=ADMIN_AUTH,
            timeout=60,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"CouchDB proxy error: {exc}")

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
