import os
import re
from typing import List, Dict, Any

class PolicyChunk:
    def __init__(
        self,
        policy_id: str,
        payer_id: str,
        section_title: str,
        service_codes: List[str],
        clause_id: str,
        clause_title: str,
        text: str
    ):
        self.policy_id = policy_id
        self.payer_id = payer_id
        self.section_title = section_title
        self.service_codes = service_codes
        self.clause_id = clause_id
        self.clause_title = clause_title
        self.text = text
        self.citation = f"{policy_id}:{clause_id}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "policy_id": self.policy_id,
            "payer_id": self.payer_id,
            "section_title": self.section_title,
            "service_codes": self.service_codes,
            "clause_id": self.clause_id,
            "clause_title": self.clause_title,
            "text": self.text,
            "citation": self.citation
        }


def chunk_policy_file(file_path: str, payer_id: str) -> List[PolicyChunk]:
    if not os.path.exists(file_path):
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract policy ID from title or text
    policy_id_match = re.search(r"\(Policy ID:\s*([^\)]+)\)", content)
    policy_id = policy_id_match.group(1).strip() if policy_id_match else f"POL-{payer_id.upper()}"

    chunks: List[PolicyChunk] = []
    
    # Split by section
    sections = re.split(r"\n##\s+", content)
    for section in sections:
        if not section.strip() or section.startswith("# "):
            continue
            
        lines = section.strip().split("\n")
        section_header = lines[0].strip()
        
        # Extract service codes from section header (e.g. CPT-72148)
        cpt_matches = re.findall(r"CPT-[\w\d]+", section_header)
        service_codes = cpt_matches if cpt_matches else []

        # Split section into clauses
        clauses = re.split(r"\n###\s+", section)
        for clause in clauses[1:]:  # skip pre-clause section preamble
            clause_lines = clause.strip().split("\n")
            clause_header = clause_lines[0].strip()
            clause_body = "\n".join(clause_lines[1:]).strip()
            
            # Format: Clause X.Y: Title
            header_match = re.match(r"(Clause\s+[\d\.]+):\s*(.*)", clause_header, re.IGNORECASE)
            if header_match:
                clause_id = header_match.group(1).strip()
                clause_title = header_match.group(2).strip()
            else:
                clause_id = "Clause"
                clause_title = clause_header

            chunk = PolicyChunk(
                policy_id=policy_id,
                payer_id=payer_id,
                section_title=section_header,
                service_codes=service_codes,
                clause_id=clause_id,
                clause_title=clause_title,
                text=f"{clause_header}\n{clause_body}"
            )
            chunks.append(chunk)

    return chunks


def load_all_policy_chunks(policies_dir: str) -> List[PolicyChunk]:
    all_chunks = []
    if not os.path.exists(policies_dir):
        return all_chunks

    for filename in os.listdir(policies_dir):
        if filename.endswith(".md"):
            payer_id = "payer_a" if "payer_a" in filename else "payer_b" if "payer_b" in filename else "generic"
            file_path = os.path.join(policies_dir, filename)
            chunks = chunk_policy_file(file_path, payer_id)
            all_chunks.extend(chunks)

    return all_chunks
