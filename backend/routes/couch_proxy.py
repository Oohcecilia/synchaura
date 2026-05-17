import os
from urllib.parse import urljoin

import requests
from fastapi import APIRouter, HTTPException, Request, Response

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


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"])
async def proxy_couch(path: str, request: Request):
    # PouchDB uses several DB-relative endpoints during replication, such as
    # _changes, _bulk_get, _bulk_docs, _revs_diff, and document ids.
    method = request.method
    body = await request.body()
    url = build_couch_url(path)

    query_string = request.url.query
    if query_string:
      url = f"{url}?{query_string}"

    forwarded_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS and key.lower() != "host"
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
