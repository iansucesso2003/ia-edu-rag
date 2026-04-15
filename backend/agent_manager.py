import json
import uuid
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

AGENTS_FILE = Path(__file__).parent / "agents.json"
UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
CHROMA_DIR = Path(__file__).parent.parent / "chroma_db"


def _load() -> dict:
    if not AGENTS_FILE.exists():
        AGENTS_FILE.write_text("{}")
    return json.loads(AGENTS_FILE.read_text())


def _save(data: dict):
    AGENTS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def list_agents() -> list:
    return list(_load().values())


def get_agent(agent_id: str) -> Optional[dict]:
    return _load().get(agent_id)


def create_agent(
    name: str,
    description: str = "",
    system_prompt: str = "",
    color: str = "#6366f1",
) -> dict:
    agent_id = str(uuid.uuid4())
    agent = {
        "id": agent_id,
        "name": name,
        "description": description,
        "system_prompt": system_prompt,
        "color": color,
        "documents": [],
        "created_at": datetime.utcnow().isoformat(),
    }
    data = _load()
    data[agent_id] = agent
    _save(data)
    (UPLOADS_DIR / agent_id).mkdir(parents=True, exist_ok=True)
    return agent


def update_agent(agent_id: str, **kwargs) -> Optional[dict]:
    data = _load()
    if agent_id not in data:
        return None
    allowed = {"name", "description", "system_prompt", "color"}
    for k, v in kwargs.items():
        if k in allowed:
            data[agent_id][k] = v
    _save(data)
    return data[agent_id]


def delete_agent(agent_id: str) -> bool:
    data = _load()
    if agent_id not in data:
        return False
    del data[agent_id]
    _save(data)
    for path in (UPLOADS_DIR / agent_id, CHROMA_DIR / agent_id):
        if path.exists():
            shutil.rmtree(path)
    return True


def add_document(agent_id: str, doc_info: dict):
    data = _load()
    if agent_id not in data:
        return
    data[agent_id]["documents"] = [
        d for d in data[agent_id]["documents"] if d["pdf_name"] != doc_info["pdf_name"]
    ]
    data[agent_id]["documents"].append(doc_info)
    _save(data)


def remove_document(agent_id: str, pdf_name: str):
    data = _load()
    if agent_id not in data:
        return
    data[agent_id]["documents"] = [
        d for d in data[agent_id]["documents"] if d["pdf_name"] != pdf_name
    ]
    _save(data)
