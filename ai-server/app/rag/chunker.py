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


def chunk_policy_text(content: str, filename: str, payer_id: str) -> List[PolicyChunk]:
    if not content.strip():
        return []

    # Extract policy ID from title or text
    policy_id_match = re.search(r"\(Policy ID:\s*([^\)]+)\)", content)
    base_name = os.path.splitext(os.path.basename(filename))[0]
    policy_id = policy_id_match.group(1).strip() if policy_id_match else f"POL-{base_name.upper()}"

    chunks: List[PolicyChunk] = []

    if "## " in content:
        sections = re.split(r"\n##\s+", content)
        for section in sections:
            if not section.strip() or section.startswith("# "):
                continue

            lines = section.strip().split("\n")
            section_header = lines[0].strip()

            cpt_matches = re.findall(r"CPT-[\w\d]+", section_header)
            service_codes = cpt_matches if cpt_matches else []

            clauses = re.split(r"\n###\s+", section)
            if len(clauses) > 1:
                for clause in clauses[1:]:
                    clause_lines = clause.strip().split("\n")
                    clause_header = clause_lines[0].strip()
                    clause_body = "\n".join(clause_lines[1:]).strip()

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
            else:
                chunks.append(PolicyChunk(
                    policy_id=policy_id,
                    payer_id=payer_id,
                    section_title=section_header,
                    service_codes=service_codes,
                    clause_id="Section",
                    clause_title=section_header,
                    text=section.strip()
                ))
    else:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if len(p.strip()) > 30]
        cpt_matches = re.findall(r"CPT-[\w\d]+", content)
        service_codes = list(set(cpt_matches))

        for idx, para in enumerate(paragraphs, 1):
            lines = para.split("\n")
            title = lines[0][:80] if lines else f"Section {idx}"
            chunks.append(PolicyChunk(
                policy_id=policy_id,
                payer_id=payer_id,
                section_title=base_name,
                service_codes=service_codes,
                clause_id=f"Sec-{idx}",
                clause_title=title,
                text=para
            ))

    return chunks


def chunk_policy_file(file_path: str, payer_id: str) -> List[PolicyChunk]:
    if not os.path.exists(file_path):
        return []

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    return chunk_policy_text(content, os.path.basename(file_path), payer_id)


def load_all_policy_chunks(policies_dir: str) -> List[PolicyChunk]:
    all_chunks = []
    if not os.path.exists(policies_dir):
        return all_chunks

    for filename in os.listdir(policies_dir):
        if filename.endswith(".md") or filename.endswith(".txt"):
            base = filename.lower()
            payer_id = "payer_a" if "payer_a" in base or "aetna" in base else "payer_b" if "payer_b" in base or "united" in base else os.path.splitext(filename)[0].lower()
            file_path = os.path.join(policies_dir, filename)
            chunks = chunk_policy_file(file_path, payer_id)
            all_chunks.extend(chunks)

    return all_chunks

