from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class DocumentMetadata(BaseModel):
    name: str
    type: str = "clinical_note"
    content: Optional[str] = None
    drive_file_id: Optional[str] = None
    uploaded_by: Optional[str] = None

class PolicyRequirement(BaseModel):
    policy_id: str
    clause_id: str
    clause_title: str
    text: str
    citation: str

class NodeTraceItem(BaseModel):
    node: str
    status: str = "COMPLETED"
    summary: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    details: Optional[Dict[str, Any]] = None

class ActionItem(BaseModel):
    app: str  # 'sheets', 'gmail', 'slack', 'calendar'
    action_type: str
    recipient_or_target: str
    payload: Dict[str, Any]
    status: str = "DISPATCHED"

class CaseState(BaseModel):
    case_id: str
    case_number: str
    patient_name: str = "Anonymous Patient"
    payer_id: str = "payer_a"
    service_type: str = "Diagnostic Imaging"
    service_code: str = "CPT-72148"
    denial_code: Optional[str] = None
    denial_reason: Optional[str] = None
    appeal_deadline: Optional[str] = None
    raw_text: Optional[str] = None

    status: str = "PENDING"
    current_node: str = "start"

    provided_documents: List[Dict[str, Any]] = Field(default_factory=list)
    policy_requirements: List[Dict[str, Any]] = Field(default_factory=list)
    found_evidence: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    citations: List[str] = Field(default_factory=list)

    route: Optional[str] = None  # 'act', 'await_human', 'abstain'
    confidence: float = 0.0
    safety_escalation: bool = False
    safety_reason: Optional[str] = None

    appeal_letter: Optional[str] = None
    actions_dispatched: List[Dict[str, Any]] = Field(default_factory=list)
    verified: bool = False
    verification_notes: Optional[str] = None

    node_trace: List[Dict[str, Any]] = Field(default_factory=list)
    is_dry_run: bool = False
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def record_node(self, node_name: str, summary: str, details: Optional[Dict[str, Any]] = None):
        self.current_node = node_name
        self.updated_at = datetime.utcnow().isoformat()
        self.node_trace.append({
            "node": node_name,
            "status": "COMPLETED",
            "summary": summary,
            "timestamp": self.updated_at,
            "details": details or {}
        })
