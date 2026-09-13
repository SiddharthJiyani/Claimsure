import os
import json
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware

from app.services.env import load_ai_env

load_ai_env()

from app.workflows.denial_workflow import DenialWorkflow
from app.services.prescription import parse_prescription
from app.rag.retriever import PolicyRetriever
from eval.harness import run_evaluation_harness

app = FastAPI(
    title="Claimsure AI Server",
    description="Autonomous Prior Authorization & Denial Recovery 9-Node Agent State Machine",
    version="3.0.0"
)

# Enable CORS for local dev (Next.js client on :3000, Express server on :5000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

workflow = DenialWorkflow()
policy_retriever = PolicyRetriever()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Claimsure AI Server",
        "version": "3.0.0",
        "nodes": [
            "1.parse_denial",
            "2.retrieve_requirements",
            "3.scan_evidence",
            "4.compute_gap",
            "5.route",
            "6.act",
            "7.await_human",
            "8.assemble_appeal",
            "9.verify"
        ],
        "dry_run_enabled": os.getenv("DRY_RUN", "false").lower() in ("true", "1", "yes")
    }

@app.post("/api/workflow/upload-and-analyze")
async def upload_and_analyze(
    file: UploadFile = File(...),
    case_id: Optional[str] = Form(None),
    case_number: Optional[str] = Form(None),
    patient_name: Optional[str] = Form(None),
    payer_id: Optional[str] = Form(None),
    service_code: Optional[str] = Form(None)
):
    """
    Direct file upload endpoint for denial letters and clinical evidence (PDF or text).
    Extracts text, parses denial, runs RAG policy retrieval, computes deterministic gap,
    and runs the 9-node agent state machine.
    """
    try:
        file_bytes = await file.read()
        filename = file.filename or "uploaded_document.pdf"
        result = workflow.process_file_upload(
            file_bytes=file_bytes,
            filename=filename,
            case_id=case_id,
            case_number=case_number,
            payer_id=payer_id,
            service_code=service_code,
            patient_name=patient_name
        )
        return {
            "success": True,
            "filename": filename,
            "case_state": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")

@app.post("/api/prescription/parse")
async def parse_prescription_upload(
    file: UploadFile = File(...),
    payer_id: Optional[str] = Form(None),
):
    """
    Parse a doctor's prescription: extract disease and the service to claim,
    then retrieve matching policy clauses from the RAG corpus.
    """
    try:
        file_bytes = await file.read()
        filename = file.filename or "prescription.pdf"
        result = parse_prescription(
            file_bytes=file_bytes,
            filename=filename,
            payer_id=payer_id,
            mime_type=file.content_type,
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prescription parse error: {str(e)}")


@app.post("/api/workflow/process-case")
async def process_case_endpoint(case_data: Dict[str, Any]):
    """
    Trigger 9-node AI agent analysis for an existing case object.
    Called by Express backend (server/) or directly by Insurer Dashboard.
    """
    try:
        result = workflow.process_case(case_data)
        return {
            "success": True,
            "case_state": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent workflow error: {str(e)}")

@app.get("/api/rag/search")
def rag_search(
    q: str = Query(..., min_length=1),
    payer_id: Optional[str] = None,
    service_code: Optional[str] = None,
):
    """Return policy search results for the backend MCP policy_search tool."""
    result = policy_retriever.retrieve(
        query=q,
        payer_id=payer_id,
        service_code=service_code,
    )

    return [
        {
            "policy_id": clause.get("policy_id", ""),
            "clause": clause.get("clause_id") or clause.get("clause_title", ""),
            "text": clause.get("text", ""),
            "score": clause.get("similarity_score", 0.0),
        }
        for clause in result.get("matched_clauses", [])
    ]

@app.post("/api/workflow/verify")
async def verify_endpoint(payload: Dict[str, Any]):
    """
    Verification loop endpoint: re-checks whether newly uploaded evidence closes the gap.
    """
    try:
        case_data = payload.get("case_data", {})
        new_doc = payload.get("new_document", {})
        result = workflow.verify_evidence_update(case_data, new_doc)
        return {
            "success": True,
            "verified": result.get("verified", False),
            "status": result.get("status"),
            "case_state": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification error: {str(e)}")

@app.get("/api/eval/results")
def get_eval_results():
    """
    Returns latest 20-case evaluation metrics table for the /insurance/eval dashboard.
    """
    results_path = os.path.join(os.path.dirname(__file__), "..", "eval", "results.json")
    if not os.path.exists(results_path):
        # Generate on the fly if not exists
        return run_evaluation_harness()

    try:
        with open(results_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading eval results: {str(e)}")

@app.post("/api/eval/run")
def trigger_eval_run():
    """
    Executes the 20-case evaluation harness and updates benchmark metrics.
    """
    try:
        results = run_evaluation_harness()
        return {
            "success": True,
            "message": "Evaluation completed successfully",
            "data": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eval run error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
