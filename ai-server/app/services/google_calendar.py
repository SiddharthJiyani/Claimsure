from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import quote

import httpx

from app.services.env import clean_env, is_dry_run

TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars"


def _calendar_id() -> str:
    return clean_env("GOOGLE_CALENDAR_ID")


def _access_token() -> str:
    creds = {
        "client_id": clean_env("GOOGLE_OAUTH_CLIENT_ID"),
        "client_secret": clean_env("GOOGLE_OAUTH_CLIENT_SECRET"),
        "refresh_token": clean_env("GOOGLE_OAUTH_REFRESH_TOKEN"),
    }
    if not all(creds.values()):
        raise RuntimeError(
            "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, "
            "GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN."
        )
    response = httpx.post(
        TOKEN_URL,
        data={**creds, "grant_type": "refresh_token"},
        timeout=20.0,
    )
    response.raise_for_status()
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Google OAuth did not return an access token")
    return token


def _date_plus_days(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()


def create_case_review_event(row: Dict[str, Any], review_in_days: int = 3) -> Optional[str]:
    if is_dry_run():
        return None
    calendar_id = _calendar_id()
    if not calendar_id:
        return "GOOGLE_CALENDAR_ID is missing"

    case_number = str(row.get("case_number") or "")
    if not case_number:
        return "case_number is required for calendar"

    start_date = _date_plus_days(review_in_days)
    end_date = _date_plus_days(review_in_days + 1)
    description = "\n".join(
        part
        for part in [
            f"Case: {case_number}",
            f"Patient: {row.get('patient_name') or ''}".rstrip(),
            f"Service: {row.get('service_type') or ''}".rstrip(),
            f"Disease: {row.get('disease') or row.get('payer_id') or ''}".rstrip(),
            f"Purpose: {row.get('claim_purpose') or row.get('denial_reason') or ''}".rstrip(),
        ]
        if ": " in part and not part.endswith(": ")
    )

    try:
        response = httpx.post(
            f"{CALENDAR_BASE}/{quote(calendar_id, safe='@.')}/events",
            headers={"Authorization": f"Bearer {_access_token()}"},
            json={
                "summary": f"Claim review: {case_number}",
                "description": description,
                "start": {"date": start_date},
                "end": {"date": end_date},
                "reminders": {
                    "useDefault": False,
                    "overrides": [
                        {"method": "email", "minutes": 60 * 24},
                        {"method": "popup", "minutes": 60 * 12},
                    ],
                },
            },
            timeout=20.0,
        )
        response.raise_for_status()
        return None
    except Exception as err:
        return str(err)
