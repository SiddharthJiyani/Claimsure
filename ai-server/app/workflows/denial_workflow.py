import uuid
import re
from typing import Dict, Any, Optional
from app.agents.state import CaseState
from app.agents.graph import ClaimsureAgentGraph
from app.services.document_parser import DocumentParser

def sanitize_input(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    cleaned = val.strip()
    if cleaned.lower() in ("", "string", "none", "null", "undefined"):
        return None
    return cleaned

class DenialWorkflow:
    def __init__(self, graph: Optional[ClaimsureAgentGraph] = None):
        self.graph = graph or ClaimsureAgentGraph()

    def process_case(self, case_data: Dict[str, Any], is_dry_run: bool = False) -> Dict[str, Any]:
        """
        Runs the 9-node agent workflow for an existing case structure.
        """
        case_id = sanitize_input(case_data.get("case_id")) or f"c-{uuid.uuid4().hex[:6]}"
        case_number = sanitize_input(case_data.get("case_number")) or f"R{uuid.uuid4().hex[:4].upper()}"
        patient_name = sanitize_input(case_data.get("patient_name")) or "Anonymous Patient"
        payer_id = sanitize_input(case_data.get("payer_id")) or "payer_a"
        service_type = sanitize_input(case_data.get("service_type")) or "Diagnostic Imaging"
        service_code = sanitize_input(case_data.get("service_code")) or "CPT-72148"

        state = CaseState(
            case_id=case_id,
            case_number=case_number,
            patient_name=patient_name,
            payer_id=payer_id,
            service_type=service_type,
            service_code=service_code,
            denial_code=case_data.get("denial_code"),
            denial_reason=case_data.get("denial_reason"),
            appeal_deadline=case_data.get("appeal_deadline"),
            raw_text=case_data.get("raw_text") or case_data.get("denial_reason"),
            provided_documents=case_data.get("provided_documents", []),
            is_dry_run=is_dry_run
        )

        final_state = self.graph.run(state)
        return final_state.model_dump()

    def process_file_upload(
        self,
        file_bytes: bytes,
        filename: str,
        case_id: Optional[str] = None,
        case_number: Optional[str] = None,
        payer_id: Optional[str] = None,
        service_code: Optional[str] = None,
        patient_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extracts textual content from uploaded denial letter / clinical document,
        initializes CaseState, and triggers the 9-node agent.
        """
        extracted_text = DocumentParser.extract_text(file_bytes, filename)
        text_lower = extracted_text.lower()

        # Sanitize any swagger default placeholders ("string", etc.)
        cid = sanitize_input(case_id) or f"c-{uuid.uuid4().hex[:6]}"
        cnum = sanitize_input(case_number) or f"R{uuid.uuid4().hex[:4].upper()}"

        # Extract patient name from document if not provided
        p_name = sanitize_input(patient_name)
        if not p_name:
            name_match = re.search(r"(?:Applicant Name|Patient Name|Member Name):\s*([A-Za-z\s]+)", extracted_text)
            if name_match:
                p_name = name_match.group(1).strip()
            else:
                salutation_match = re.search(r"Dear\s+(?:Ms\.|Mr\.|Dr\.)\s+([A-Za-z]+):", extracted_text)
                p_name = salutation_match.group(1).strip() if salutation_match else "Claimant"

        # Identify payer from document text if not provided
        pid = sanitize_input(payer_id)
        if not pid:
            if "unicare" in text_lower:
                pid = "unicare"
            elif "payer_b" in text_lower or "united" in text_lower:
                pid = "payer_b"
            elif "payer_a" in text_lower or "aetna" in text_lower or "bluecross" in text_lower:
                pid = "payer_a"
            else:
                pid = "payer_a"

        # Check if service code was provided or leave to parse_denial
        scode = sanitize_input(service_code) or "PENDING_CLASSIFICATION"

        state = CaseState(
            case_id=cid,
            case_number=cnum,
            patient_name=p_name,
            payer_id=pid,
            service_code=scode,
            raw_text=extracted_text,
            denial_reason=extracted_text[:300],
            provided_documents=[
                {
                    "name": filename,
                    "type": "denial_letter",
                    "content": extracted_text
                }
            ]
        )

        final_state = self.graph.run(state)
        result = final_state.model_dump()
        result["extracted_text_preview"] = extracted_text[:400]
        return result

    def verify_evidence_update(
        self,
        case_data: Dict[str, Any],
        new_document: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Adds newly uploaded evidence document to case and triggers verify loop.
        """
        docs = list(case_data.get("provided_documents", []))
        docs.append(new_document)
        case_data["provided_documents"] = docs

        state = CaseState(**case_data)
        updated_state = self.graph.verify_update(state)
        return updated_state.model_dump()
