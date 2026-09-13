import io
from typing import Optional
from pypdf import PdfReader

class DocumentParser:
    @staticmethod
    def extract_text(file_bytes: bytes, filename: str) -> str:
        """
        Extracts raw textual content from uploaded file bytes (PDF or Text).
        """
        if not file_bytes:
            return ""

        filename_lower = filename.lower()
        if filename_lower.endswith(".pdf"):
            try:
                reader = PdfReader(io.BytesIO(file_bytes))
                text_pages = []
                for idx, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text_pages.append(page_text)
                extracted = "\n".join(text_pages).strip()
                if extracted:
                    return extracted
            except Exception as e:
                # If PDF extraction fails, attempt decoding as text
                pass

        # Try standard UTF-8 text decoding
        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1").strip()
            except Exception:
                return f"[Binary document received: {filename}]"
