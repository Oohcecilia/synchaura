from env import load_local_env

load_local_env()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import router as auth_router
from routes.couch_proxy import router as couch_proxy_router
from routes.google_calendar import router as google_calendar_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://synchaura.dpdns.org",
        "https://www.synchaura.dpdns.org",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://localhost:4174",
        "http://localhost:3001",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:4174",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")
app.include_router(couch_proxy_router)
app.include_router(couch_proxy_router, prefix="/api")
app.include_router(google_calendar_router)
app.include_router(google_calendar_router, prefix="/api")
