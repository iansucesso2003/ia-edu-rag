"""
RAG chain: retrieves relevant chunks and generates an answer using the
agent's own system prompt.

System prompt rules:
  - If the agent's system_prompt contains the placeholder {context}, the
    retrieved chunks are injected there.
  - If it does NOT contain {context}, the chunks are appended at the end.
  - If the agent has NO system_prompt at all, a safe read-only default is used.
"""

import os
from openai import AsyncOpenAI
from dotenv import load_dotenv
import vector_store

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o")

_DEFAULT_PROMPT = (
    "Você responde EXCLUSIVAMENTE com base nos documentos fornecidos.\n"
    "Se não encontrar a informação, diga: "
    "'Não encontrei essa informação nos documentos carregados.'\n"
    "Nunca use conhecimento externo.\n"
    "Cite sempre: nome do arquivo e página.\n\n"
    "CONTEXTO DOS DOCUMENTOS:\n{context}"
)


def _build_system_prompt(agent_system_prompt: str, context: str) -> str:
    base = agent_system_prompt.strip() if agent_system_prompt.strip() else _DEFAULT_PROMPT

    if "{context}" in base:
        return base.replace("{context}", context)

    return f"{base}\n\nCONTEXTO DOS DOCUMENTOS:\n{context}"


async def answer(
    agent_id: str,
    question: str,
    chat_history: list[dict],
    custom_system_prompt: str = "",
) -> dict:
    chunks = vector_store.search(agent_id, question, n=5)

    if not chunks:
        return {
            "answer": "Não encontrei essa informação nos documentos carregados.",
            "sources": [],
        }

    context_parts: list[str] = []
    sources: list[dict] = []
    seen: set[tuple] = set()

    for chunk in chunks:
        meta = chunk["metadata"]
        pdf_name = meta["pdf_name"]
        page_num = meta["page_num"]
        context_parts.append(f"[{pdf_name} — Página {page_num}]\n{chunk['text']}")
        key = (pdf_name, page_num)
        if key not in seen:
            seen.add(key)
            sources.append({"pdf_name": pdf_name, "page_num": int(page_num)})

    context = "\n\n---\n\n".join(context_parts)
    system_prompt = _build_system_prompt(custom_system_prompt, context)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in chat_history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    response = await client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        temperature=0.1,
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": sources,
    }
