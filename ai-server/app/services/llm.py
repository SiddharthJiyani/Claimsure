import os
import json
import time
from typing import Dict, Any, Optional, Type, TypeVar
from pydantic import BaseModel
import httpx

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

T = TypeVar("T", bound=BaseModel)

class LLMService:
    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_API_KEY")
        self.provider = os.getenv("DEFAULT_LLM_PROVIDER", "gemini").lower()
        self.dry_run = os.getenv("DRY_RUN", "false").lower() in ("true", "1", "yes")

    def _call_gemini(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        """Calls Google Gemini 2.5 Flash with structured JSON output."""
        if not self.gemini_key:
            raise ValueError("GEMINI_API_KEY is not set")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.gemini_key}"
        payload = {
            "system_instruction": {
                "parts": [{"text": f"{system_prompt}\nYou MUST return ONLY a valid JSON object matching the required structure."}]
            },
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)

    def _call_groq(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        """Calls Groq API with Qwen 3.6 27B."""
        if not self.groq_key:
            raise ValueError("GROQ_API_KEY is not set")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "qwen/qwen3.6-27b",
            "messages": [
                {"role": "system", "content": f"{system_prompt}\nReturn valid JSON adhering strictly to the schema."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
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
        retries: int = 1
    ) -> T:
        """
        Executes an LLM call enforcing Pydantic schema validation.
        Priority: Gemini 2.5 Flash -> Groq -> Mock Fallback.
        """
        if self.dry_run or (not self.gemini_key and not self.groq_key):
            if mock_fallback:
                return response_schema.model_validate(mock_fallback)
            return response_schema.model_validate({})

        for attempt in range(retries + 1):
            # Attempt Gemini first
            if self.gemini_key:
                try:
                    result_dict = self._call_gemini(prompt, system_prompt)
                    return response_schema.model_validate(result_dict)
                except Exception as gemini_err:
                    pass

            # Attempt Groq secondary
            if self.groq_key:
                try:
                    result_dict = self._call_groq(prompt, system_prompt)
                    return response_schema.model_validate(result_dict)
                except Exception as groq_err:
                    pass

            time.sleep(0.5)

        # High-Fidelity Fallback if external API encounters issues
        if mock_fallback:
            return response_schema.model_validate(mock_fallback)
        return response_schema.model_validate({})
