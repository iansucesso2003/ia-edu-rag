import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

load_dotenv()

CHROMA_BASE = Path(os.getenv("DATA_DIR", str(Path(__file__).parent.parent))) / "chroma_db"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Per-agent cache: { agent_id -> (client, collection) }
_cache: dict[str, tuple] = {}


def _get_collection(agent_id: str) -> chromadb.Collection:
    if agent_id not in _cache:
        db_path = str(CHROMA_BASE / agent_id)
        Path(db_path).mkdir(parents=True, exist_ok=True)

        chroma_client = chromadb.PersistentClient(path=db_path)
        ef = embedding_functions.OpenAIEmbeddingFunction(
            api_key=OPENAI_API_KEY,
            model_name=EMBEDDING_MODEL,
        )
        collection = chroma_client.get_or_create_collection(
            name=f"agent_{agent_id.replace('-', '_')}",
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )
        _cache[agent_id] = (chroma_client, collection)

    return _cache[agent_id][1]


def _invalidate(agent_id: str):
    _cache.pop(agent_id, None)


def add_chunks(agent_id: str, chunks: list[dict]):
    if not chunks:
        return
    collection = _get_collection(agent_id)
    ids = [f"{c['pdf_name']}__p{c['page_num']}__i{i}" for i, c in enumerate(chunks)]
    documents = [c["text"] for c in chunks]
    metadatas = [
        {
            "agent_id": c["agent_id"],
            "pdf_name": c["pdf_name"],
            "page_num": c["page_num"],
            "has_image": str(c["has_image"]),
        }
        for c in chunks
    ]
    collection.add(ids=ids, documents=documents, metadatas=metadatas)


def search(agent_id: str, query: str, n: int = 5) -> list[dict]:
    collection = _get_collection(agent_id)
    count = collection.count()
    if count == 0:
        return []
    results = collection.query(
        query_texts=[query],
        n_results=min(n, count),
    )
    return [
        {"text": doc, "metadata": meta}
        for doc, meta in zip(results["documents"][0], results["metadatas"][0])
    ]


def list_documents(agent_id: str) -> list[str]:
    collection = _get_collection(agent_id)
    result = collection.get(include=["metadatas"])
    seen: set[str] = set()
    for meta in result["metadatas"]:
        seen.add(meta["pdf_name"])
    return list(seen)


def delete_document(agent_id: str, pdf_name: str):
    collection = _get_collection(agent_id)
    result = collection.get(where={"pdf_name": pdf_name})
    if result["ids"]:
        collection.delete(ids=result["ids"])
    _invalidate(agent_id)
