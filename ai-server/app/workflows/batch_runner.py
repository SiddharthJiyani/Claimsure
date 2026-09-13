import os
import json
import time
from typing import List, Dict, Any, Optional
from app.workflows.denial_workflow import DenialWorkflow

class BatchRunner:
    def __init__(self, workflow: Optional[DenialWorkflow] = None, data_dir: Optional[str] = None):
        self.workflow = workflow or DenialWorkflow()
        if data_dir is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(current_dir, "..", "..", "data")
        self.data_dir = os.path.abspath(data_dir)
        self.cases_file = os.path.join(self.data_dir, "cases.json")

    def run_all(self, is_dry_run: bool = True) -> List[Dict[str, Any]]:
        """
        Loads all cases from cases.json and runs them sequentially,
        collecting latencies and outputs.
        """
        if not os.path.exists(self.cases_file):
            raise FileNotFoundError(f"Cases file not found at: {self.cases_file}")

        with open(self.cases_file, "r", encoding="utf-8") as f:
            cases = json.load(f)

        results = []
        for case in cases:
            start_time = time.time()
            output_state = self.workflow.process_case(case, is_dry_run=is_dry_run)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)

            results.append({
                "case_id": case.get("case_id"),
                "case_number": case.get("case_number"),
                "expected": case,
                "actual": output_state,
                "latency_ms": elapsed_ms
            })

        return results
