import os
import json
import time
import base64
import logging
from typing import Dict, Any, Optional, Type, TypeVar
from pydantic import BaseModel
import httpx

from app.services.env import gemini_api_key, groq_api_key, is_dry_run, load_ai_env

load_ai_env()

logger = logging.getLogger("claimsure.llm")
T = TypeVar("T", bound=BaseModel)

PREFERRED_GEMINI_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]
_cached_gemini_models: Optional[list] = None


class LLMService:
    def __init__(self):
        load_ai_env()
        self.gemini_key = gemini_api_key()
        self.groq_key = groq_api_key()
        self.provider = os.getenv("DEFAULT_LLM_PROVIDER", "gemini").lower()
        self.dry_run = is_dry_run()

    def _gemini_url(self, model: str) -> str:
        return (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={self.gemini_key}"
        )

    def _gemini_models(self) -> list:
        global _cached_gemini_models
        if _cached_gemini_models:
            return _cached_gemini_models

        configured = os.getenv("GEMINI_MODEL", "").strip()
        models: list = []
        if configured:
            models.append(configured)

        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={self.gemini_key}"
                )
                data = resp.json() if resp.is_success else {}
            listed = []
            for item in data.get("models") or []:
                methods = item.get("supportedGenerationMethods") or []
                if "generateContent" not in methods:
                    continue
                name = str(item.get("name") or "").split("/")[-1]
                if name:
                    listed.append(name)
            flash = [name for name in listed if "flash" in name and "image" not in name]
            models.extend(flash or listed)
        except Exception as err:
            logger.warning("Could not list Gemini models: %s", err)

        models.extend(PREFERRED_GEMINI_MODELS)
        deduped = []
        for name in models:
            if name and name not in deduped:
                deduped.append(name)
        _cached_gemini_models = deduped
        logger.info("Gemini models to try: %s", ", ".join(deduped[:6]))
        return deduped

    def _extract_gemini_text(self, data: Dict[str, Any]) -> str:
        if data.get("error"):
            message = data["error"].get("message") if isinstance(data["error"], dict) else str(data["error"])
            raise ValueError(message or "Gemini request failed")
        candidates = data.get("candidates") or []
        if not candidates:
            feedback = data.get("promptFeedback") or {}
            raise ValueError(
                feedback.get("blockReason")
                or "Gemini returned no text for this file",
            )
        parts = candidates[0].get("content", {}).get("parts") or []
        text = "".join(part.get("text", "") for part in parts).strip()
        if not text:
            raise ValueError("Gemini returned an empty transcription")
        return text

    def _post_gemini(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        last_error = "Gemini request failed"
        with httpx.Client(timeout=60.0) as client:
            for model in self._gemini_models():
                for attempt in range(2):
                    resp = client.post(self._gemini_url(model), json=payload)
                    data = resp.json()
                    if resp.is_success:
                        return data
                    last_error = (
                        data.get("error", {}).get("message")
                        if isinstance(data.get("error"), dict)
                        else f"Gemini {model} HTTP {resp.status_code}"
                    )
                    logger.warning("Gemini model %s failed: %s", model, last_error)
                    busy = "high demand" in last_error.lower() or resp.status_code == 429
                    missing = "not found" in last_error.lower() or "no longer available" in last_error.lower()
                    if missing:
                        break
                    if busy and attempt == 0:
                        time.sleep(1.2)
                        continue
                    break
        raise ValueError(last_error)

    def _call_gemini(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        if not self.gemini_key:
            raise ValueError("GEMINI_API_KEY is not set")

        payload = {
            "systemInstruction": {
                "parts": [
                    {
                        "text": (
                            f"{system_prompt}\nYou MUST return ONLY a valid JSON "
                            "object matching the required structure."
                        )
                    }
                ]
            },
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }
        raw_text = self._extract_gemini_text(self._post_gemini(payload))
        return json.loads(raw_text)

    def transcribe_document(
        self,
        file_bytes: bytes,
        mime_type: str,
        filename: str,
    ) -> str:
        if self.dry_run:
            raise ValueError("Vision parsing is disabled while DRY_RUN=true.")
        if not self.gemini_key:
            raise ValueError("GEMINI_API_KEY is not set in ai-server/.env")
        if not file_bytes:
            raise ValueError("The uploaded file was empty")

        normalized = mime_type.split(";")[0].strip().lower()
        if normalized in {"image/jpg", "image/pjpeg"}:
            normalized = "image/jpeg"
        if normalized not in {
            "image/jpeg",
            "image/png",
            "application/pdf",
            "image/webp",
        }:
            raise ValueError(f"Unsupported file type: {normalized or filename}")

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "Transcribe this doctor's prescription or clinical "
                                "order exactly. Include patient name, diagnosis, "
                                "medications, procedures, and codes. Return plain text only."
                            )
                        },
                        {
                            "inlineData": {
                                "mimeType": normalized,
                                "data": base64.b64encode(file_bytes).decode("ascii"),
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1},
        }
        return self._extract_gemini_text(self._post_gemini(payload))

    def _call_groq(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        if not self.groq_key:
            raise ValueError("GROQ_API_KEY is not set")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {
                    "role": "system",
                    "content": f"{system_prompt}\nReturn valid JSON adhering strictly to the schema.",
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw_text = data["choices"][0]["message"]["content"]
            return json.loads(raw_text)

    def call_structured(
        self,
        prompt: str,
        system_prompt: str,
        response_schema: Type[T],
        mock_fallback: Optional[Dict[str, Any]] = None,
        retries: int = 1,
    ) -> T:
        if self.dry_run or (not self.gemini_key and not self.groq_key):
            if mock_fallback:
                return response_schema.model_validate(mock_fallback)
            return response_schema.model_validate({})

        for _ in range(retries + 1):
            if self.gemini_key:
                try:
                    return response_schema.model_validate(
                        self._call_gemini(prompt, system_prompt)
                    )
                except Exception as err:
                    logger.warning("Gemini structured call failed: %s", err)

            if self.groq_key:
                try:
                    return response_schema.model_validate(
                        self._call_groq(prompt, system_prompt)
                    )
                except Exception as err:
                    logger.warning("Groq structured call failed: %s", err)

            time.sleep(0.5)

        if mock_fallback:
            return response_schema.model_validate(mock_fallback)
        return response_schema.model_validate({})
