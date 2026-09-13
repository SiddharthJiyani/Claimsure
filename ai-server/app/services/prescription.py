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
    normalized_text = " ".join(text.split())
    is_enrollment_denial = bool(
        re.search(
            r"(?:cannot offer membership|cannot offer enrollment|medical underwriting guidelines|declined)",
            normalized_text,
            re.IGNORECASE,
        )
    )
    is_prior_auth_denial = bool(
        re.search(
            r"(?:prior authorization|adverse determination|requested procedure|denial code)",
            normalized_text,
            re.IGNORECASE,
        )
    )

    patient_name = None
    name_match = re.search(
        r"(?:applicant name|patient name)\s*:\s*([A-Za-z][A-Za-z .'-]+?)(?=\s+identification\s+no\.?\s*:|[.!?]|\s{2,}|$)",
        normalized_text,
        re.IGNORECASE,
    )
    if name_match:
        patient_name = name_match.group(1).strip()
    member_match = re.search(
        r"(?:member name|applicant name|patient name)\s*:\s*([A-Za-z][A-Za-z .'-]+?)(?=\s+(?:claim|identification|requesting|dear)\b|$)",
        normalized_text,
        re.IGNORECASE,
    )
    if not patient_name and member_match:
        patient_name = member_match.group(1).strip()

    diagnosis = ""
    dx_match = re.search(
        r"(?:diagnosis|dx|condition|impression)\s*[:\-]\s*(.+)",
        normalized_text,
        re.IGNORECASE,
    )
    if dx_match:
        diagnosis = dx_match.group(1).split("\n")[0].strip()[:180]

    if is_enrollment_denial:
        history_match = re.search(
            r"records document a history of\s+(.+?)(?=\s+Unfortunately,|\s+Your height|\s+We regret)",
            normalized_text,
            re.IGNORECASE,
        )
        if history_match:
            diagnosis = history_match.group(1).strip(" .")[:240]
    elif is_prior_auth_denial:
        deficiency_match = re.search(
            r"specific deficiency identified:\s*1\.\s*(.+?)(?=\s+2\.|\s+appeal rights|$)",
            normalized_text,
            re.IGNORECASE,
        )
        diagnosis = (
            deficiency_match.group(1).strip(" .")[:240]
            if deficiency_match
            else "Medical necessity not established in the submitted documentation"
        )

    service = ""
    svc_match = re.search(
        r"(?:procedure|service|order|plan|imaging)\s*[:\-]\s*(.+)",
        normalized_text,
        re.IGNORECASE,
    )
    if svc_match:
        service = svc_match.group(1).split("\n")[0].strip()[:180]

    requested_match = re.search(
        r"requested procedure\s*:\s*(.+?)(?=\s+denial determination|\s+your request|$)",
        normalized_text,
        re.IGNORECASE,
    )
    if requested_match:
        service = requested_match.group(1).strip(" .")[:180]

    if is_enrollment_denial:
        service = "Individual health insurance enrollment"

    code_match = re.search(
        r"\bCPT[-:\s]*(\d{4,5}[A-Za-z]?)\b",
        normalized_text,
        re.IGNORECASE,
    )
    icd_match = re.search(r"\b([A-Z]\d{2}(?:\.\d{1,4})?)\b", normalized_text)

    if not diagnosis:
        diagnosis = "Condition not clearly stated in the document"
    if not service:
        service = diagnosis

    service_code = None
    if not is_enrollment_denial:
        service_code = (
            f"CPT-{code_match.group(1)}"
            if code_match
            else icd_match.group(1)
            if icd_match
            else None
        )

    claim_purpose = (
        f"Review coverage eligibility for {service} based on the documented medical history"
        if is_enrollment_denial
        else f"Request coverage for {service} because the submitted documentation requires review"
        if is_prior_auth_denial
        else f"Coverage for {service} related to {diagnosis}"
    )

    return {
        "patient_name": patient_name,
        "disease": diagnosis,
        "service_type": service,
        "service_code": service_code,
        "claim_purpose": claim_purpose,
        "medications": [],
        "summary": (
            f"The document declines {service.lower()} because of {diagnosis}."
            if is_enrollment_denial
            else f"The request for {service} was denied because {diagnosis}."
            if is_prior_auth_denial
            else normalized_text[:280].strip()
        ),
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
    parsed_values = parsed.model_dump()
    for field in ("disease", "service_type", "claim_purpose", "summary"):
        if not str(parsed_values.get(field) or "").strip():
            parsed_values[field] = fallback[field]
    if str(parsed_values["claim_purpose"]).strip().lower() in {
        "to obtain health insurance coverage.",
        "to obtain health insurance coverage",
    }:
        parsed_values["claim_purpose"] = fallback["claim_purpose"]
    if not parsed_values.get("patient_name"):
        parsed_values["patient_name"] = fallback["patient_name"]
    if not parsed_values.get("service_code"):
        parsed_values["service_code"] = fallback["service_code"]
    parsed = PrescriptionParse.model_validate(parsed_values)

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
