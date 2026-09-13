import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def load_ai_env() -> None:
    root = Path(__file__).resolve().parents[2]
    env_path = root / ".env"
    if load_dotenv:
        load_dotenv(env_path, override=True)
        load_dotenv(override=False)


def clean_env(name: str, *aliases: str) -> str:
    for key in (name, *aliases):
        raw = os.getenv(key)
        if raw is None:
            continue
        value = raw.strip().strip('"').strip("'")
        if value:
            return value
    return ""


def gemini_api_key() -> str:
    return clean_env("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY")


def groq_api_key() -> str:
    return clean_env("GROQ_API_KEY", "VITE_GROQ_API_KEY")


def is_dry_run() -> bool:
    return clean_env("DRY_RUN", "dry_run").lower() in ("true", "1", "yes")
