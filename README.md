# RAG Studio — Multi-Agent RAG com OpenAI + ChromaDB

Aplicação full-stack que permite criar múltiplos agentes de RAG isolados. Cada agente tem seus próprios PDFs, base vetorial e system prompt completamente personalizado.

---

## Estrutura

```
pdf-rag/
├── backend/
│   ├── main.py              # FastAPI — endpoints REST
│   ├── agent_manager.py     # CRUD de agentes (persistido em agents.json)
│   ├── pdf_processor.py     # Extração de texto / visão via GPT-4o
│   ├── vector_store.py      # ChromaDB isolado por agente
│   ├── rag_chain.py         # Recuperação + geração da resposta
│   ├── agents.json          # Banco de dados dos agentes
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── uploads/{agent_id}/      # PDFs por agente
└── chroma_db/{agent_id}/    # Vetores por agente
```

---

## Instalação

### 1. Pré-requisitos

- Python 3.11+
- Chave de API OpenAI

### 2. Backend

```bash
cd pdf-rag/backend

# Crie e ative o ambiente virtual
python -m venv .venv
source .venv/bin/activate        # Linux/Mac
# .venv\Scripts\activate         # Windows

# Instale as dependências
pip install -r requirements.txt
```

### 3. Variáveis de ambiente

Edite `backend/.env` e adicione sua chave:

```env
OPENAI_API_KEY=sk-...
VISION_MODEL=gpt-4o
CHAT_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
PROCESS_ALL_PAGES_WITH_VISION=false
```

| Variável | Descrição |
|---|---|
| `OPENAI_API_KEY` | Sua chave da OpenAI |
| `VISION_MODEL` | Modelo para extração visual de páginas com imagens |
| `CHAT_MODEL` | Modelo para geração de respostas |
| `EMBEDDING_MODEL` | Modelo de embeddings |
| `PROCESS_ALL_PAGES_WITH_VISION` | `true` para processar todas as páginas com visão (mais lento, mais preciso) |

### 4. Inicie o servidor

```bash
cd pdf-rag/backend
uvicorn main:app --reload --port 8000
```

O backend fica disponível em `http://localhost:8000`.  
Documentação automática: `http://localhost:8000/docs`

### 5. Frontend

Abra `frontend/index.html` diretamente no navegador — não precisa de servidor.

```bash
open pdf-rag/frontend/index.html    # Mac
xdg-open pdf-rag/frontend/index.html  # Linux
```

---

## Como usar

### Criar um agente

1. Clique em **+ Novo Agente** na barra lateral.
2. Preencha nome, descrição e — o mais importante — o **System Prompt**.
3. Escolha uma cor identificadora.
4. Clique em **Criar Agente**.

### System Prompt

O system prompt é **totalmente livre**. Você escreve as instruções que quiser.

Para injetar os trechos dos documentos no lugar certo, use o placeholder `{context}`:

```
Você é um assistente especializado em contratos jurídicos.
Responda sempre em português formal.
Cite o arquivo e a página de cada informação.
Responda SOMENTE com base nos trechos abaixo.

{context}
```

Se você **não incluir `{context}`**, os trechos são adicionados automaticamente ao final do prompt.

Se você **não escrever nenhum prompt**, um prompt padrão seguro (somente documentos) é usado.

### Indexar documentos

1. Selecione um agente na barra lateral.
2. Arraste PDFs para a zona de upload ou clique para selecionar.
3. Vários arquivos são processados em paralelo.
4. Cada página com imagens ou texto insuficiente é enviada ao GPT-4o Vision automaticamente.

### Chat

1. Com um agente selecionado, use a coluna da direita para conversar.
2. As fontes (arquivo + página) aparecem abaixo de cada resposta.
3. Use **Limpar histórico** para reiniciar a conversa.

---

## API REST

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/agents` | Criar agente |
| `GET` | `/agents` | Listar agentes |
| `GET` | `/agents/{id}` | Obter agente |
| `PATCH` | `/agents/{id}` | Atualizar agente |
| `DELETE` | `/agents/{id}` | Excluir agente + dados |
| `POST` | `/agents/{id}/upload` | Enviar PDFs (multipart) |
| `GET` | `/agents/{id}/documents` | Listar documentos |
| `DELETE` | `/agents/{id}/documents/{nome}` | Remover documento |
| `POST` | `/agents/{id}/chat` | Enviar pergunta |

### Exemplo de chat via curl

```bash
curl -X POST http://localhost:8000/agents/{AGENT_ID}/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Qual é o prazo de vigência do contrato?",
    "chat_history": []
  }'
```

Resposta:

```json
{
  "answer": "O prazo de vigência é de 12 meses... [Contrato.pdf — Página 3]",
  "sources": [
    { "pdf_name": "Contrato.pdf", "page_num": 3 }
  ]
}
```

---

## Isolamento entre agentes

- Cada agente tem sua própria pasta `uploads/{agent_id}/` e `chroma_db/{agent_id}/`.
- As consultas vetoriais são restritas à coleção do agente selecionado.
- Excluir um agente remove todos os dados associados.

---

## Dependências principais

| Pacote | Uso |
|---|---|
| `fastapi` | Framework web |
| `uvicorn` | Servidor ASGI |
| `pymupdf` | Leitura de PDFs |
| `openai` | Chat, Vision e Embeddings |
| `chromadb` | Banco vetorial persistente |
| `langchain-text-splitters` | Chunking de texto |
| `python-multipart` | Upload de arquivos |
| `python-dotenv` | Variáveis de ambiente |
