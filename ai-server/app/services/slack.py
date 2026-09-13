import json
import os
import urllib.request
from typing import Any, Optional


def slack_webhook_url() -> str:
    return (os.getenv("SLACK_WEBHOOK_URL") or "").strip()


def is_slack_configured() -> bool:
    return slack_webhook_url().startswith("https://hooks.slack.com/")


def post_channel_update(
    title: str,
    message: str,
    case_number: Optional[str] = None,
    event: Optional[str] = None,
) -> Optional[str]:
    url = slack_webhook_url()
    if not url.startswith("https://hooks.slack.com/"):
        return "not_configured"

    text = f"{title} · {case_number}" if case_number else title
    payload: dict[str, Any] = {
        "text": text,
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": title[:150]},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": message[:2900]},
            },
        ],
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return "ok" if response.status < 300 else f"http_{response.status}"
    except Exception as exc:  # noqa: BLE001
        return str(exc)
