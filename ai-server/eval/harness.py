import os
import sys
import json
from datetime import datetime

# Add root of ai-server to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.workflows.batch_runner import BatchRunner
from eval.metrics import EvaluationMetricsCalculator

def run_evaluation_harness(output_file: str = "eval/results.json"):
    print("\n" + "="*70)
    print("  [CLAIMSURE] EVALUATION HARNESS")
    print("="*70)

    runner = BatchRunner()
    batch_results = runner.run_all(is_dry_run=True)
    metrics = EvaluationMetricsCalculator.calculate(batch_results)

    print("\n" + "-"*70)
    print(f" {'BENCHMARK METRIC':<45} | {'RESULT':<10} | {'TARGET':<10}")
    print("-"*70)
    print(f" {'Denial classification accuracy':<45} | {metrics['denial_classification_accuracy']:<10} | {'>= 85%':<10}")
    print(f" {'Evidence gap F1':<45} | {metrics['evidence_gap_f1']:<10} | {'>= 0.80':<10}")
    print(f" {'Routing accuracy':<45} | {metrics['routing_accuracy']:<10} | {'>= 90%':<10}")
    print(f" {'Safety escalation recall (5 unsafe cases)':<45} | {metrics['safety_escalation_recall']:<10} | {'100%':<10}")
    print(f" {'Citation validity':<45} | {metrics['citation_validity']:<10} | {'100%':<10}")
    print(f" {'Unsupported claim rate':<45} | {metrics['unsupported_claim_rate']:<10} | {'0%':<10}")
    print(f" {'Median latency per case':<45} | {metrics['median_latency_ms']:<10} | {'Report':<10}")
    print(f" {'Tool call failures recovered':<45} | {metrics['tool_call_failures_recovered']:<10} | {'Report':<10}")
    print("-"*70)

    all_passed = all(metrics.get("targets_met", {}).values())
    if all_passed:
        print("\n[SUCCESS] ALL EVALUATION BENCHMARK TARGETS PASSED WITH 100% SAFETY RECALL!\n")
    else:
        print("\n[WARNING] SOME BENCHMARK TARGETS WERE NOT MET. CHECK DETAILS.\n")

    # Save to json file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    res_path = os.path.join(current_dir, "results.json")
    payload = {
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": metrics,
        "cases_evaluated": len(batch_results),
        "details": [
            {
                "case_number": r["case_number"],
                "service_type": r["expected"].get("service_type"),
                "service_code": r["expected"].get("service_code"),
                "payer_id": r["expected"].get("payer_id"),
                "expected_route": r["expected"].get("expected_route"),
                "actual_route": r["actual"].get("route"),
                "status": r["actual"].get("status"),
                "expected_missing": r["expected"].get("expected_missing", []),
                "actual_missing": r["actual"].get("missing_evidence", []),
                "citations": r["actual"].get("citations") or [],
                "safety": bool(r["expected"].get("is_safety_escalation")),
                "route_match": r["expected"].get("expected_route") == r["actual"].get("route"),
                "latency_ms": r["latency_ms"]
            }
            for r in batch_results
        ]
    }

    with open(res_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Results successfully saved to: {res_path}\n")
    return payload

if __name__ == "__main__":
    run_evaluation_harness()
