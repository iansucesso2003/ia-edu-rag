import base64
import os
from pathlib import Path

import fitz  # pymupdf
from openai import AsyncOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
VISION_MODEL = os.getenv("VISION_MODEL", "gpt-4o")
PROCESS_ALL_WITH_VISION = os.getenv("PROCESS_ALL_PAGES_WITH_VISION", "false").lower() == "true"

splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=80)


async def _extract_page_via_vision(page: fitz.Page) -> str:
    """Render the page as PNG and use GPT-4o Vision to extract all content."""
    mat = fitz.Matrix(2, 2)
    pix = page.get_pixmap(matrix=mat)
    b64 = base64.b64encode(pix.tobytes("png")).decode()

    response = await client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{b64}",
                            "detail": "high",
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract ALL text and content from this document page. "
                            "Include text from tables, captions, headers, footers. "
                            "If there are charts or diagrams, describe them concisely. "
                            "Return only the extracted content, no commentary."
                        ),
                    },
                ],
            }
        ],
        max_tokens=2000,
    )
    return response.choices[0].message.content or ""


async def process_pdf(pdf_path: Path, agent_id: str) -> list[dict]:
    """Process a PDF file and return a list of text chunks with metadata."""
    pdf_name = pdf_path.name
    doc = fitz.open(str(pdf_path))
    all_chunks: list[dict] = []

    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        has_image = bool(page.get_images())

        use_vision = PROCESS_ALL_WITH_VISION or has_image or len(text.strip()) < 150

        content = await _extract_page_via_vision(page) if use_vision else text

        if not content.strip():
            continue

        for chunk in splitter.split_text(content):
            all_chunks.append(
                {
                    "text": chunk,
                    "agent_id": agent_id,
                    "pdf_name": pdf_name,
                    "page_num": page_num,
                    "has_image": has_image,
                }
            )

    doc.close()
    return all_chunks
