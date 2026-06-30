import os

import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from routes.auth import get_authenticated_user

router = APIRouter(prefix="/api/routing", tags=["geolocation"])

OPENROUTESERVICE_API_KEY = os.getenv("OPENROUTESERVICE_API_KEY")
ORS_BASE_URL = "https://api.openrouteservice.org"
REQUEST_TIMEOUT = 15


class RouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    profile: str = "driving-car"


@router.post("")
@router.post("/")
def get_route(request: Request, body: RouteRequest):
    if not OPENROUTESERVICE_API_KEY:
        raise HTTPException(status_code=500, detail="OpenRouteService is not configured")

    # Authenticate the user
    try:
        get_authenticated_user(request)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Authentication required")

    coordinates = [[body.origin_lng, body.origin_lat], [body.dest_lng, body.dest_lat]]

    try:
        response = requests.post(
            f"{ORS_BASE_URL}/v2/directions/{body.profile}/geojson",
            headers={
                "Authorization": OPENROUTESERVICE_API_KEY,
                "Content-Type": "application/json",
            },
            json={"coordinates": coordinates},
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Routing service error: {exc}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"OpenRouteService error: {response.text}",
        )

    data = response.json()

    # Extract summary info from the response
    features = data.get("features", [])
    summary = {}
    if features:
        props = features[0].get("properties", {})
        segments = props.get("segments", [])
        if segments:
            segment = segments[0]
            summary = {
                "distance": segment.get("distance"),  # meters
                "duration": segment.get("duration"),  # seconds
            }

    return {
        "route": data,
        "summary": summary,
    }
