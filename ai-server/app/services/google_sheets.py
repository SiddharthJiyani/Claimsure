from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx

from app.services.env import clean_env, is_dry_run

PREFERRED_TAB = "Cases"
HEADER_ROW = [
    "Case Number",
    "Status",
    "Service Type",
    "Service Code",
    "Patient ID",
    "Insurer Org ID",
    "Created At",
    "Updated At",
    "Patient Name",
    "Disease",
    "Claim Purpose",
    "Drive URL",
]
LAST_COL = "L"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets"


def _spreadsheet_id() -> str:
    return clean_env("GOOGLE_SHEETS_ID")


def _quoted(name: str) -> str:
    return quote(f"'{name.replace(chr(39), chr(39) * 2)}'", safe="")


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


def _values(row: Dict[str, Any]) -> List[str]:
    return [
        str(row.get("case_number") or ""),
        str(row.get("status") or ""),
        str(row.get("service_type") or ""),
        str(row.get("service_code") or ""),
        str(row.get("patient_id") or row.get("payer_id") or ""),
        str(row.get("insurer_org_id") or ""),
        str(row.get("created_at") or ""),
        str(row.get("updated_at") or ""),
        str(row.get("patient_name") or ""),
        str(row.get("disease") or row.get("payer_id") or ""),
        str(row.get("claim_purpose") or row.get("denial_reason") or ""),
        str(row.get("drive_url") or ""),
    ]


def _resolve_sheet(client: httpx.Client, spreadsheet_id: str) -> str:
    meta = client.get(
        f"{SHEETS_BASE}/{spreadsheet_id}",
        params={"fields": "sheets(properties(title))"},
    )
    meta.raise_for_status()
    titles = [
        sheet.get("properties", {}).get("title")
        for sheet in meta.json().get("sheets", [])
        if sheet.get("properties", {}).get("title")
    ]
    sheet_name = PREFERRED_TAB if PREFERRED_TAB in titles else (titles[0] if titles else PREFERRED_TAB)
    header = client.get(
        f"{SHEETS_BASE}/{spreadsheet_id}/values/{_quoted(sheet_name)}!A1:{LAST_COL}1"
    )
    header.raise_for_status()
    first = (header.json().get("values") or [[]])[0]
    if not any(str(cell).strip() for cell in first):
        update = client.put(
            f"{SHEETS_BASE}/{spreadsheet_id}/values/{_quoted(sheet_name)}!A1:{LAST_COL}1",
            params={"valueInputOption": "USER_ENTERED"},
            json={"values": [HEADER_ROW]},
        )
        update.raise_for_status()
    return sheet_name


def upsert_case_row(row: Dict[str, Any]) -> Optional[str]:
    if is_dry_run():
        return None
    spreadsheet_id = _spreadsheet_id()
    if not spreadsheet_id:
        return "GOOGLE_SHEETS_ID is missing"

    try:
        with httpx.Client(
            headers={"Authorization": f"Bearer {_access_token()}"},
            timeout=20.0,
        ) as client:
            sheet_name = _resolve_sheet(client, spreadsheet_id)
            existing = client.get(
                f"{SHEETS_BASE}/{spreadsheet_id}/values/{_quoted(sheet_name)}!A:A"
            )
            existing.raise_for_status()
            numbers = [cells[0] if cells else "" for cells in existing.json().get("values") or []]
            case_number = str(row.get("case_number") or "")
            values = {"values": [_values(row)]}
            try:
                row_index = numbers.index(case_number)
            except ValueError:
                row_index = -1

            if row_index <= 0:
                append = client.post(
                    f"{SHEETS_BASE}/{spreadsheet_id}/values/{_quoted(sheet_name)}!A:{LAST_COL}:append",
                    params={
                        "valueInputOption": "USER_ENTERED",
                        "insertDataOption": "INSERT_ROWS",
                    },
                    json=values,
                )
                append.raise_for_status()
                return None

            update = client.put(
                f"{SHEETS_BASE}/{spreadsheet_id}/values/{_quoted(sheet_name)}!A{row_index + 1}:{LAST_COL}{row_index + 1}",
                params={"valueInputOption": "USER_ENTERED"},
                json=values,
            )
            update.raise_for_status()
            return None
    except Exception as err:
        return str(err)
