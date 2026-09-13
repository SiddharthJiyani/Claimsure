import os
import json
import math
import numpy as np
import httpx
from typing import List, Dict, Any, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

def compute_deterministic_embedding(text: str, dim: int = 128) -> List[float]:
    """
    Computes a deterministic normalized vector representation of text
    using word hashing and character n-grams. Guarantees 0-latency offline
    semantic similarity without requiring an external API key.
    """
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().replace(",", " ").replace(".", " ").replace(":", " ").split()
    if not words:
        return vec.tolist()

    for word in words:
        h = 0
        for ch in word:
            h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        idx = h % dim
        vec[idx] += 1.0

        # Bigram features
        for i in range(len(word) - 1):
            bg = (ord(word[i]) * 37 + ord(word[i+1])) & 0xFFFFFFFF
            vec[bg % dim] += 0.5

    norm = np.linalg.norm(vec)
    if norm > 1e-6:
        vec = vec / norm
    return vec.tolist()


def get_embedding(text: str) -> List[float]:
    """
    Returns text embedding using Google Gemini (models/gemini-embedding-001)
    with automatic fallback to deterministic term vectorizer.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={gemini_key}"
            payload = {
                "content": {
                    "parts": [{"text": text[:1000]}]
                }
            }
            with httpx.Client(timeout=5.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json()["embedding"]["values"]
        except Exception:
            pass

    return compute_deterministic_embedding(text)


def build_and_save_embeddings(
    chunks: List[Dict[str, Any]],
    output_path: str
) -> Dict[str, Any]:
    """
    Computes embeddings for all chunks and persists to JSON.
    """
    embeddings_data = []
    for chunk in chunks:
        emb = get_embedding(chunk["text"])
        item = {
            "citation": chunk["citation"],
            "policy_id": chunk["policy_id"],
            "payer_id": chunk["payer_id"],
            "service_codes": chunk["service_codes"],
            "clause_id": chunk["clause_id"],
            "clause_title": chunk["clause_title"],
            "text": chunk["text"],
            "embedding": emb
        }
        embeddings_data.append(item)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(embeddings_data, f, indent=2)

    return {"count": len(embeddings_data), "path": output_path}
