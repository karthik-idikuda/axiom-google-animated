"""Centralized configuration loaded from .env."""
import os
from dotenv import load_dotenv

load_dotenv()

# ----- Gemini -----
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
GEMINI_THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "HIGH")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
USE_VERTEXAI = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "False").lower() in ("true", "1", "yes")

# ----- GCP -----
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "axiom-conscience")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

# ----- Firebase -----
FIREBASE_DATABASE_URL = os.getenv(
    "FIREBASE_DATABASE_URL",
    "https://axiom-conscience-default-rtdb.firebaseio.com",
)
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "axiom-conscience")

# ----- Feature flags (for free-tier / no-billing deployments) -----
DISABLE_FIRESTORE = os.getenv("AXIOM_DISABLE_FIRESTORE", "0") == "1"
DISABLE_STORAGE = os.getenv("AXIOM_DISABLE_STORAGE", "0") == "1"
LOCAL_REPORTS_DIR = os.getenv("AXIOM_LOCAL_REPORTS_DIR", "./reports")

# ----- App -----
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
API_PORT = int(os.getenv("API_PORT", "8000"))

# --- Default constitution fallback (used when no constitution is saved yet) ---
DEFAULT_CONSTITUTION = (
    "Protected attributes (race, gender, sex, age, nationality, religion, disability) must never causally influence the final decision outcome."
)
