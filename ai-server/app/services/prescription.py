import re
from typing import Any, Dict, Optional

from app.agents.prompts import (
    PRESCRIPTION_PARSER_SYSTEM_PROMPT,
    PrescriptionParse,
)
from app.rag.retriever import PolicyRetriever
from app.services.document_parser import (
    ALLOWED_EXTENSIONS,
    DocumentParser,
    mime_for_filename,
)
from app.services.llm import LLMService


def _heuristic_parse(text: str) -> Dict[str, Any]:
    diagnosis = ""
    dx_match = re.search(
        r"(?:diagnosis|dx|condition|impression)\s*[:\-]\s*(.+)",
        text,
        re.IGNORECASE,
    )
    if dx_match:
        diagnosis = dx_match.group(1).split("\n")[0].strip()[:180]

    service = ""
    svc_match = re.search(
        r"(?:procedure|service|order|plan|imaging)\s*[:\-]\s*(.+)",
        text,
        re.IGNORECASE,
    )
    if svc_match:
        service = svc_match.group(1).split("\n")[0].strip()[:180]

    code_match = re.search(r"\b(?:CPT[-:\s]*)?(\d{4,5}[A-Za-z]?)\b", text)
    icd_match = re.search(r"\b([A-Z]\d{2}(?:\.\d{1,4})?)\b", text)

    if not diagnosis:
        diagnosis = "Condition noted on prescription"
    if not service:
        service = diagnosis

    return {
        "patient_name": None,
        "disease": diagnosis,
        "service_type": service,
        "service_code": f"CPT-{code_match.group(1)}" if code_match else icd_match.group(1) if icd_match else None,
        "claim_purpose": f"Coverage for {service} related to {diagnosis}",
        "medications": [],
        "summary": text[:280].strip(),
        "confidence": 0.45,
    }


def parse_prescription(
    file_bytes: bytes,
    filename: str,
    payer_id: Optional[str] = None,
    mime_type: Optional[str] = None,
) -> Dict[str, Any]:
    suffix = "." + filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix and suffix not in ALLOWED_EXTENSIONS and mime_for_filename(filename) is None:
        raise ValueError("Upload a JPEG, PNG, or PDF prescription.")

    try:
        extracted_text = DocumentParser.extract_text(
            file_bytes,
            filename,
            mime_type=mime_type,
        )
    except ValueError:
        raise
    except Exception as err:
        raise ValueError(f"Could not read this file: {err}") from err
    if not extracted_text:
        raise ValueError(
            "Could not read text from this JPEG, PNG, or PDF.",
        )

    fallback = _heuristic_parse(extracted_text)
    llm = LLMService()
    parsed = llm.call_structured(
        prompt=extracted_text[:8000],
        system_prompt=PRESCRIPTION_PARSER_SYSTEM_PROMPT,
        response_schema=PrescriptionParse,
        mock_fallback=fallback,
    )

    query = " ".join(
        part
        for part in [
            parsed.disease,
            parsed.service_type,
            parsed.claim_purpose,
            extracted_text[:1200],
        ]
        if part
    )

    retriever = PolicyRetriever()
    rag = retriever.retrieve(
        query=query,
        payer_id=payer_id,
        service_code=parsed.service_code,
        top_k=3,
    )

    return {
        "filename": filename,
        "source_type": mime_for_filename(filename) or mime_type or "application/pdf",
        "extracted_text": extracted_text[:4000],
        "parse": parsed.model_dump(),
        "rag": {
            "citations": rag.get("citations", []),
            "matched_clauses": rag.get("matched_clauses", []),
            "confidence": rag.get("confidence", 0),
            "policy_missing": rag.get("policy_missing", True),
            "reason": rag.get("reason"),
        },
    }
