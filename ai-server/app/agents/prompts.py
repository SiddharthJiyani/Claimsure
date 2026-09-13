from typing import List, Optional
from pydantic import BaseModel, Field

class ParsedDenial(BaseModel):
    denial_code: Optional[str] = Field(default="CO-50", description="Claim adjustment reason code e.g. CO-50, PR-204, or None")
    denial_reason: Optional[str] = Field(default="Adverse determination or enrollment declination", description="Primary clinical rationale for denial")
    service_code: Optional[str] = Field(default=None, description="CPT procedure code e.g. CPT-72148, or None for general enrollment denial")
    service_type: Optional[str] = Field(default=None, description="Procedure or service name e.g. Lumbar MRI or Health Plan Enrollment")
    patient_name: Optional[str] = Field(default=None, description="Applicant or patient full name if found in document")
    payer_name: Optional[str] = Field(default=None, description="Payer or health plan name e.g. UniCare, Aetna")
    appeal_deadline: Optional[str] = Field(default=None, description="ISO appeal deadline date YYYY-MM-DD")
    is_enrollment_denial: bool = Field(default=False, description="True if denial is for insurance enrollment/underwriting rather than a procedure prior-auth")
    confidence: float = Field(default=0.9, description="Extraction confidence score between 0.0 and 1.0")

class AppealDraft(BaseModel):
    subject: str
    letter_text: str
    cited_clauses: List[str]
    clinical_arguments: List[str]
    is_expedited: bool = False

class VerificationCheck(BaseModel):
    gap_closed: bool
    unresolved_items: List[str] = Field(default_factory=list)
    explanation: str

DENIAL_PARSER_SYSTEM_PROMPT = """You are an expert clinical claim adjudication analyst.
Extract structured information from the provided denial letter or clinical prior-authorization document.
Identify:
1. Patient or applicant name.
2. Payer organization name (e.g. UniCare, Aetna, BlueCross).
3. CPT procedure code (if this is for a specific medical procedure; otherwise null).
4. Denial code (e.g. CO-50, PR-204, or null).
5. Clinical denial reason.
6. Whether this is an insurance enrollment/underwriting declination (is_enrollment_denial: true/false).
7. Appeal deadline date.

Return valid JSON adhering to the ParsedDenial schema."""

APPEAL_DRAFTER_SYSTEM_PROMPT = """You are a senior healthcare appeal specialist drafting a formal medical necessity appeal.
You must cite the exact policy clauses provided in the context.
DO NOT hallucinate citations or medical facts. Every assertion must be grounded in the provided policy clauses and submitted patient records.
Return valid JSON adhering to the AppealDraft schema."""

VERIFICATION_SYSTEM_PROMPT = """You are a clinical compliance auditor verifying whether newly uploaded clinical documentation resolves prior evidence gaps.
Return valid JSON adhering to the VerificationCheck schema."""
