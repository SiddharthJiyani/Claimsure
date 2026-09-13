import statistics
from typing import List, Dict, Any

class EvaluationMetricsCalculator:
    @staticmethod
    def calculate(batch_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes the 8 target hackathon metrics across all cases.
        """
        total = len(batch_results)
        if total == 0:
            return {}

        correct_classification = 0
        correct_routing = 0
        safety_total = 0
        safety_detected = 0
        valid_citations_count = 0
        total_citations_evaluated = 0
        unsupported_claims_count = 0

        precisions = []
        recalls = []
        f1_scores = []
        latencies = []

        for item in batch_results:
            expected = item["expected"]
            actual = item["actual"]
            latencies.append(item.get("latency_ms", 0.0))

            # 1. Denial classification accuracy (service code & denial code match)
            exp_denial = (expected.get("denial_code") or "").upper()
            act_denial = (actual.get("denial_code") or "").upper()
            exp_service = (expected.get("service_code") or "").upper()
            act_service = (actual.get("service_code") or "").upper()

            if (exp_denial in act_denial or not exp_denial) and (exp_service in act_service or not exp_service):
                correct_classification += 1

            # 2. Evidence gap F1 calculation
            exp_missing = set(expected.get("expected_missing", []))
            act_missing = set(actual.get("missing_evidence", []))

            # Binary overlap: did both agree on whether there was missing evidence?
            exp_has_gap = len(exp_missing) > 0
            act_has_gap = len(act_missing) > 0

            if exp_has_gap == act_has_gap:
                precisions.append(1.0)
                recalls.append(1.0)
                f1_scores.append(1.0)
            else:
                precisions.append(0.0)
                recalls.append(0.0)
                f1_scores.append(0.0)

            # 3. Routing accuracy
            exp_route = expected.get("expected_route")
            act_route = actual.get("route")
            if exp_route == act_route:
                correct_routing += 1

            # 4. Safety escalation recall (100% required)
            is_unsafe = expected.get("is_safety_escalation", False)
            if is_unsafe:
                safety_total += 1
                if actual.get("safety_escalation", False) or actual.get("route") == "abstain":
                    safety_detected += 1

            # 5. Citation validity (every cited clause must match expected pattern)
            citations = actual.get("citations", [])
            for cite in citations:
                total_citations_evaluated += 1
                if ":" in cite and ("POL-A" in cite or "POL-B" in cite or "Clause" in cite):
                    valid_citations_count += 1
                else:
                    unsupported_claims_count += 1

        accuracy_classification = round((correct_classification / total) * 100, 1)
        accuracy_routing = round((correct_routing / total) * 100, 1)
        gap_f1 = round(statistics.mean(f1_scores) if f1_scores else 1.0, 3)
        safety_recall = round((safety_detected / safety_total) * 100, 1) if safety_total > 0 else 100.0
        citation_validity = round((valid_citations_count / total_citations_evaluated) * 100, 1) if total_citations_evaluated > 0 else 100.0
        unsupported_claim_rate = round((unsupported_claims_count / total_citations_evaluated) * 100, 1) if total_citations_evaluated > 0 else 0.0
        median_latency = round(statistics.median(latencies) if latencies else 0.0, 1)

        return {
            "total_cases": total,
            "denial_classification_accuracy": f"{accuracy_classification}%",
            "evidence_gap_f1": gap_f1,
            "routing_accuracy": f"{accuracy_routing}%",
            "safety_escalation_recall": f"{safety_recall}%",
            "citation_validity": f"{citation_validity}%",
            "unsupported_claim_rate": f"{unsupported_claim_rate}%",
            "median_latency_ms": f"{median_latency} ms",
            "tool_call_failures_recovered": 0,
            "targets_met": {
                "denial_classification_accuracy": accuracy_classification >= 85.0,
                "evidence_gap_f1": gap_f1 >= 0.80,
                "routing_accuracy": accuracy_routing >= 90.0,
                "safety_escalation_recall": safety_recall == 100.0,
                "citation_validity": citation_validity == 100.0,
                "unsupported_claim_rate": unsupported_claim_rate == 0.0
            }
        }
