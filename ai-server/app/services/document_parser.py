import io
from typing import Optional

from pypdf import PdfReader

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | {".pdf"}


def mime_for_filename(filename: str) -> Optional[str]:
    name = filename.lower()
    if name.endswith(".pdf"):
        return "application/pdf"
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".jpg") or name.endswith(".jpeg"):
        return "image/jpeg"
    return None


class DocumentParser:
    @staticmethod
    def extract_text(
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
    ) -> str:
        if not file_bytes:
            return ""

        filename_lower = filename.lower()
        resolved_mime = (mime_type or mime_for_filename(filename) or "").split(";")[0].strip().lower()
        if resolved_mime in {"image/jpg", "image/pjpeg"}:
            resolved_mime = "image/jpeg"

        if filename_lower.endswith(".pdf"):
            try:
                reader = PdfReader(io.BytesIO(file_bytes))
                text_pages = []
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_pages.append(page_text)
                extracted = "\n".join(text_pages).strip()
                if extracted:
                    return extracted
            except Exception:
                pass
            return DocumentParser._transcribe(file_bytes, "application/pdf", filename)

        if resolved_mime in {"image/jpeg", "image/png"} or any(
            filename_lower.endswith(ext) for ext in IMAGE_EXTENSIONS
        ):
            return DocumentParser._transcribe(
                file_bytes,
                resolved_mime or "image/jpeg",
                filename,
            )

        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1").strip()
            except Exception:
                return ""

    @staticmethod
    def _transcribe(file_bytes: bytes, mime_type: str, filename: str) -> str:
        from app.services.llm import LLMService

        return LLMService().transcribe_document(file_bytes, mime_type, filename)
