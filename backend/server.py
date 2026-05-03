from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection (exported for routers via auth.get_db)
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Own Recovery API")

# Include routers (import after db is set so auth.get_db works)
from routes_auth import router as auth_router
from routes_health import router as health_router
from routes_supporter import router as supporter_router
from routes_clinician import router as clinician_router
from routes_consent import router as consent_router
from routes_llm import router as llm_router
from routes_insights import router as insights_router
from routes_onboarding import router as onboarding_router
from routes_sobriety import router as sobriety_router
from routes_craving import router as craving_router
from routes_resources import router as resources_router
from routes_steps import router as steps_router

app.include_router(auth_router)
app.include_router(health_router)
app.include_router(supporter_router)
app.include_router(clinician_router)
app.include_router(consent_router)
app.include_router(llm_router)
app.include_router(insights_router)
app.include_router(onboarding_router)
app.include_router(sobriety_router)
app.include_router(craving_router)
app.include_router(resources_router)
app.include_router(steps_router)


@app.get("/api/")
async def root():
    return {"service": "Own Recovery", "status": "ok"}


@app.get("/api/health-check")
async def health_check():
    try:
        await db.command("ping")
        return {"status": "healthy"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


_cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
if _cors_origins_env.strip() == "*":
    # With credentials, browsers reject wildcard. Use regex to echo origin.
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=".*",
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["set-cookie"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=_cors_origins_env.split(","),
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["set-cookie"],
    )

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
