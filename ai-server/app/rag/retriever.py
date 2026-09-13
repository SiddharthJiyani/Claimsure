import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
from app.rag.chunker import load_all_policy_chunks
from app.rag.embeddings import get_embedding, compute_deterministic_embedding

class PolicyRetriever:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            # Look relative to current file or working directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(current_dir, "..", "..", "data")

        self.data_dir = os.path.abspath(data_dir)
        self.policies_dir = os.path.join(self.data_dir, "policies")
        self.embeddings_path = os.path.join(self.data_dir, "embeddings.json")
        self.chunks: List[Dict[str, Any]] = []
        self._load_corpus()

    def _load_corpus(self):
        """Loads chunks and pre-computed embeddings if available, or extracts from policies."""
        if os.path.exists(self.embeddings_path):
            try:
                with open(self.embeddings_path, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)
                return
            except Exception:
                pass

        # Fallback: load raw chunks and compute deterministic vectors
        raw_chunks = load_all_policy_chunks(self.policies_dir)
        self.chunks = []
        for c in raw_chunks:
            c_dict = c.to_dict()
            c_dict["embedding"] = compute_deterministic_embedding(c_dict["text"])
            self.chunks.append(c_dict)

        # Save embeddings for future fast loading
        try:
            os.makedirs(os.path.dirname(self.embeddings_path), exist_ok=True)
            with open(self.embeddings_path, "w", encoding="utf-8") as f:
                json.dump(self.chunks, f, indent=2)
        except Exception:
            pass

    def retrieve(
        self,
        query: str,
        payer_id: Optional[str] = None,
        service_code: Optional[str] = None,
        top_k: int = 3,
        min_threshold: float = 0.25
    ) -> Dict[str, Any]:
        """
        Filters by payer_id and service_code, computes cosine similarity,
        and returns matching clauses with citations.
        """
        if not self.chunks:
            return {
                "matched_clauses": [],
                "citations": [],
                "confidence": 0.0,
                "policy_missing": True,
                "reason": "No policy documents loaded"
            }

        candidates = self.chunks

        # Stage 1: Metadata filtering
        if payer_id:
            filtered_by_payer = [c for c in candidates if c.get("payer_id") == payer_id.lower()]
            if filtered_by_payer:
                candidates = filtered_by_payer
            else:
                # Payer not recognized or missing
                return {
                    "matched_clauses": [],
                    "citations": [],
                    "confidence": 0.0,
                    "policy_missing": True,
                    "reason": f"No policy found for payer: {payer_id}"
                }

        if service_code:
            # Filter if service_code matches or if chunk has generic policy rules
            code_candidates = [
                c for c in candidates
                if not c.get("service_codes") or service_code.upper() in [sc.upper() for sc in c.get("service_codes", [])]
            ]
            if code_candidates:
                candidates = code_candidates

        # Stage 2: Cosine similarity
        query_vec = np.array(compute_deterministic_embedding(query), dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)

        scored_chunks = []
        for chunk in candidates:
            chunk_vec = np.array(chunk.get("embedding", []), dtype=np.float32)
            chunk_norm = np.linalg.norm(chunk_vec)

            if query_norm > 1e-6 and chunk_norm > 1e-6:
                similarity = float(np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm))
            else:
                similarity = 0.0

            # Boost if query keywords match clause text or title
            q_lower = query.lower()
            if chunk.get("clause_title", "").lower() in q_lower:
                similarity += 0.2
            if service_code and service_code.lower() in chunk.get("text", "").lower():
                similarity += 0.15

            scored_chunks.append((similarity, chunk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        top_results = scored_chunks[:top_k]
        best_score = top_results[0][0] if top_results else 0.0

        if best_score < min_threshold:
            return {
                "matched_clauses": [],
                "citations": [],
                "confidence": best_score,
                "policy_missing": True,
                "reason": "Confidence below threshold; abstain to prevent hallucination"
            }

        matched_clauses = []
        citations = []
        for score, chunk in top_results:
            citation = chunk.get("citation", f"{chunk.get('policy_id')}:{chunk.get('clause_id')}")
            citations.append(citation)
            matched_clauses.append({
                "citation": citation,
                "policy_id": chunk.get("policy_id"),
                "clause_id": chunk.get("clause_id"),
                "clause_title": chunk.get("clause_title"),
                "text": chunk.get("text"),
                "similarity_score": round(score, 3)
            })

        return {
            "matched_clauses": matched_clauses,
            "citations": list(dict.fromkeys(citations)),  # unique
            "confidence": round(best_score, 3),
            "policy_missing": False,
            "reason": "Requirements successfully retrieved"
        }
