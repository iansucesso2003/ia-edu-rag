import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import agent_manager
import pdf_processor
import rag_chain
import vector_store

app = FastAPI(title="Multi-Agent RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
UPLOADS_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent.parent))) / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# ─── Schemas ──────────────────────────────────────────────────────────────────


class AgentCreate(BaseModel):
    name: str
    description: str = ""
    system_prompt: str = ""
    color: str = "#6366f1"


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    color: Optional[str] = None


class ChatRequest(BaseModel):
    question: str
    chat_history: list[dict] = []


# ─── Agent CRUD ───────────────────────────────────────────────────────────────


@app.post("/agents", status_code=201)
async def create_agent(body: AgentCreate):
    return agent_manager.create_agent(**body.model_dump())


@app.get("/agents")
async def list_agents():
    return agent_manager.list_agents()


@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = agent_manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


@app.patch("/agents/{agent_id}")
async def update_agent(agent_id: str, body: AgentUpdate):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    agent = agent_manager.update_agent(agent_id, **updates)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


@app.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str):
    if not agent_manager.delete_agent(agent_id):
        raise HTTPException(404, "Agent not found")


# ─── Documents ────────────────────────────────────────────────────────────────


@app.post("/agents/{agent_id}/upload")
async def upload_files(agent_id: str, files: list[UploadFile] = File(...)):
    if not agent_manager.get_agent(agent_id):
        raise HTTPException(404, "Agent not found")

    upload_dir = UPLOADS_DIR / agent_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    async def process_one(file: UploadFile) -> dict:
        pdf_path = upload_dir / file.filename
        pdf_path.write_bytes(await file.read())
        try:
            chunks = await pdf_processor.process_pdf(pdf_path, agent_id)
            pages = max((c["page_num"] for c in chunks), default=0)
            has_any_image = any(c["has_image"] for c in chunks)
            vector_store.add_chunks(agent_id, chunks)
            doc_info = {
                "pdf_name": file.filename,
                "pages": pages,
                "chunks": len(chunks),
                "has_image": has_any_image,
                "status": "ok",
            }
            agent_manager.add_document(agent_id, doc_info)
            return doc_info
        except Exception as exc:
            return {"pdf_name": file.filename, "status": "error", "error": str(exc)}

    results = await asyncio.gather(*[process_one(f) for f in files])
    return {"results": list(results)}


@app.get("/agents/{agent_id}/documents")
async def list_documents(agent_id: str):
    agent = agent_manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent.get("documents", [])


@app.delete("/agents/{agent_id}/documents/{pdf_name}", status_code=204)
async def delete_document(agent_id: str, pdf_name: str):
    if not agent_manager.get_agent(agent_id):
        raise HTTPException(404, "Agent not found")
    vector_store.delete_document(agent_id, pdf_name)
    agent_manager.remove_document(agent_id, pdf_name)
    pdf_path = UPLOADS_DIR / agent_id / pdf_name
    if pdf_path.exists():
        pdf_path.unlink()


# ─── Chat ─────────────────────────────────────────────────────────────────────


@app.post("/agents/{agent_id}/chat")
async def chat(agent_id: str, body: ChatRequest):
    agent = agent_manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return await rag_chain.answer(
        agent_id=agent_id,
        question=body.question,
        chat_history=body.chat_history,
        custom_system_prompt=agent.get("system_prompt", ""),
    )
