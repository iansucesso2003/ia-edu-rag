/* ─────────────────────────────────────────────────────────────────────────────
   Multi-Agent RAG — Frontend
───────────────────────────────────────────────────────────────────────────── */

const API = window.API_URL || "http://localhost:8000";

let agents = [];
let selectedAgentId = null;
const chatHistories = {}; // { agentId: [{role, content, sources?}] }

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init() {
  bindEvents();
  await loadAgents();
}

// ── API helper ────────────────────────────────────────────────────────────────

async function api(method, path, body = null) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Agents ────────────────────────────────────────────────────────────────────

async function loadAgents() {
  agents = await api("GET", "/agents");
  renderAgentList();
}

function renderAgentList() {
  const list = document.getElementById("agentList");
  if (!agents.length) {
    list.innerHTML = '<p class="empty-hint">Nenhum agente criado.</p>';
    return;
  }
  list.innerHTML = agents
    .map(
      (a) => `
      <div class="agent-item ${a.id === selectedAgentId ? "active" : ""}"
           data-id="${a.id}"
           onclick="selectAgent('${a.id}')">
        <div class="agent-dot" style="background:${a.color}"></div>
        <div class="agent-info">
          <span class="agent-item-name">${esc(a.name)}</span>
          <span class="agent-item-docs">
            ${a.documents.length} doc${a.documents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>`
    )
    .join("");
}

async function selectAgent(id) {
  selectedAgentId = id;
  renderAgentList();
  const agent = agents.find((a) => a.id === id);
  if (!agent) return;
  showChat(agent);
  renderChat();
}

function showAgentDetail(agent) {
  document.getElementById("agentNameInput").value = agent.name;
  document.getElementById("agentDescInput").value = agent.description || "";
  document.getElementById("agentPromptInput").value = agent.system_prompt || "";
}

function openSettings() {
  if (!selectedAgentId) return;
  const agent = agents.find((a) => a.id === selectedAgentId);
  if (!agent) return;
  showAgentDetail(agent);
  renderDocs(agent.documents);
  document.getElementById("settingsOverlay").classList.remove("hidden");
}

function closeSettings() {
  document.getElementById("settingsOverlay").classList.add("hidden");
}

function showChat(agent) {
  document.getElementById("emptyMain").classList.add("hidden");
  document.getElementById("chatContainer").classList.remove("hidden");
  document.getElementById("chatAgentName").textContent = agent.name;
  document.getElementById("chatAgentDot").style.background = agent.color;
}

// ── Modal: Create Agent ───────────────────────────────────────────────────────

function openModal() {
  document.getElementById("modalOverlay").classList.remove("hidden");
  document.getElementById("modalName").focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("modalName").value = "";
  document.getElementById("modalDesc").value = "";
  document.getElementById("modalPrompt").value = "";
  document.getElementById("modalColor").value = "#6366f1";
}

async function createAgent() {
  const name = document.getElementById("modalName").value.trim();
  if (!name) { document.getElementById("modalName").focus(); return; }

  try {
    const agent = await api("POST", "/agents", {
      name,
      description: document.getElementById("modalDesc").value,
      system_prompt: document.getElementById("modalPrompt").value,
      color: document.getElementById("modalColor").value,
    });
    agents.push(agent);
    closeModal();
    renderAgentList();
    selectAgent(agent.id);
  } catch (e) {
    showToast("Erro ao criar agente.", true);
  }
}

// ── Update / Delete Agent ─────────────────────────────────────────────────────

async function saveAgent() {
  if (!selectedAgentId) return;
  try {
    const updated = await api("PATCH", `/agents/${selectedAgentId}`, {
      name: document.getElementById("agentNameInput").value.trim(),
      description: document.getElementById("agentDescInput").value,
      system_prompt: document.getElementById("agentPromptInput").value,
    });
    const idx = agents.findIndex((a) => a.id === selectedAgentId);
    if (idx !== -1) agents[idx] = { ...agents[idx], ...updated };
    document.getElementById("chatAgentName").textContent = updated.name;
    renderAgentList();
    closeSettings();
    showToast("Agente salvo!");
  } catch (e) {
    showToast("Erro ao salvar.", true);
  }
}

async function deleteAgent() {
  if (!selectedAgentId) return;
  if (!confirm("Excluir este agente e todos os seus documentos? Esta ação não pode ser desfeita.")) return;
  try {
    await api("DELETE", `/agents/${selectedAgentId}`);
    agents = agents.filter((a) => a.id !== selectedAgentId);
    delete chatHistories[selectedAgentId];
    selectedAgentId = null;
    renderAgentList();
    closeSettings();
    document.getElementById("emptyMain").classList.remove("hidden");
    document.getElementById("chatContainer").classList.add("hidden");
  } catch (e) {
    showToast("Erro ao excluir.", true);
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────

function handleFiles(files) {
  if (!selectedAgentId || !files.length) return;
  const pdfs = [...files].filter(
    (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
  );
  if (!pdfs.length) { showToast("Selecione apenas arquivos PDF.", true); return; }
  uploadFiles(pdfs);
}

async function uploadFiles(files) {
  const progressList = document.getElementById("uploadProgressList");

  // Create progress entries
  const entries = files.map((f) => {
    const entryId = `prog_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const el = document.createElement("div");
    el.className = "progress-entry";
    el.id = entryId;
    el.innerHTML = `
      <span class="prog-name">${esc(f.name)}</span>
      <div class="prog-bar-wrap"><div class="prog-bar" id="${entryId}_bar"></div></div>
      <span class="prog-status" id="${entryId}_status">Processando…</span>`;
    progressList.appendChild(el);
    animateBar(entryId);
    return { file: f, entryId };
  });

  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  try {
    const { results } = await api("POST", `/agents/${selectedAgentId}/upload`, formData);

    results.forEach((r) => {
      const entry = entries.find((e) => e.file.name === r.pdf_name);
      if (!entry) return;
      const bar = document.getElementById(`${entry.entryId}_bar`);
      const status = document.getElementById(`${entry.entryId}_status`);
      if (r.status === "ok") {
        bar.style.width = "100%";
        bar.style.background = "#22c55e";
        status.textContent = `${r.chunks} chunks · ${r.pages} pág${r.has_image ? " · 🖼" : ""}`;
        status.style.color = "#22c55e";
      } else {
        bar.style.background = "#ef4444";
        status.textContent = `Erro: ${r.error}`;
        status.style.color = "#ef4444";
      }
    });

    // Refresh agent state
    const updatedAgent = await api("GET", `/agents/${selectedAgentId}`);
    const idx = agents.findIndex((a) => a.id === selectedAgentId);
    if (idx !== -1) agents[idx] = updatedAgent;
    renderDocs(updatedAgent.documents);
    renderAgentList();
  } catch (e) {
    entries.forEach(({ entryId }) => {
      const status = document.getElementById(`${entryId}_status`);
      if (status) { status.textContent = "Falha no upload"; status.style.color = "#ef4444"; }
    });
    showToast("Erro no upload.", true);
  }

  // Auto-remove progress bars
  setTimeout(() => entries.forEach(({ entryId }) => document.getElementById(entryId)?.remove()), 5000);
}

function animateBar(entryId) {
  const bar = document.getElementById(`${entryId}_bar`);
  if (!bar) return;
  let w = 0;
  const iv = setInterval(() => {
    if (!document.getElementById(`${entryId}_bar`)) { clearInterval(iv); return; }
    if (w >= 85) { clearInterval(iv); return; }
    w = Math.min(w + Math.random() * 7, 85);
    bar.style.width = w + "%";
  }, 300);
}

// ── Documents ─────────────────────────────────────────────────────────────────

function renderDocs(docs) {
  const list = document.getElementById("docsList");
  if (!docs.length) {
    list.innerHTML = '<p class="no-docs">Nenhum documento indexado.</p>';
    return;
  }
  list.innerHTML = docs
    .map(
      (d) => `
      <div class="doc-item">
        <div class="doc-icon">${d.has_image ? "🖼" : "📄"}</div>
        <div class="doc-info">
          <span class="doc-name" title="${esc(d.pdf_name)}">${esc(d.pdf_name)}</span>
          <span class="doc-meta">${d.pages} pág · ${d.chunks} chunks</span>
        </div>
        <button class="btn-remove-doc"
                onclick="removeDoc('${esc(d.pdf_name)}')"
                title="Remover documento">✕</button>
      </div>`
    )
    .join("");
}

async function removeDoc(pdfName) {
  if (!confirm(`Remover "${pdfName}" e seus vetores?`)) return;
  try {
    await api("DELETE", `/agents/${selectedAgentId}/documents/${encodeURIComponent(pdfName)}`);
    const idx = agents.findIndex((a) => a.id === selectedAgentId);
    if (idx !== -1) {
      agents[idx].documents = agents[idx].documents.filter((d) => d.pdf_name !== pdfName);
      renderDocs(agents[idx].documents);
      renderAgentList();
    }
  } catch (e) {
    showToast("Erro ao remover documento.", true);
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

function renderChat() {
  const msgs = chatHistories[selectedAgentId] || [];
  const container = document.getElementById("chatMessages");

  if (!msgs.length) {
    container.innerHTML =
      '<div class="chat-welcome">Olá! Faça uma pergunta sobre os documentos indexados.</div>';
    return;
  }

  container.innerHTML = msgs
    .map((m) => {
      if (m.role === "user") {
        return `<div class="msg msg-user"><div class="msg-bubble">${esc(m.content)}</div></div>`;
      }
      const sourcesHtml = (m.sources || [])
        .map((s) => `<span class="source-chip">📄 ${esc(s.pdf_name)} p.${s.page_num}</span>`)
        .join("");
      return `
        <div class="msg msg-assistant">
          <div class="msg-bubble">${renderMarkdown(m.content)}</div>
          ${sourcesHtml ? `<div class="sources">${sourcesHtml}</div>` : ""}
        </div>`;
    })
    .join("");

  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("chatInput");
  const question = input.value.trim();
  if (!question || !selectedAgentId) return;

  input.value = "";
  setInputState(false);

  if (!chatHistories[selectedAgentId]) chatHistories[selectedAgentId] = [];
  const history = chatHistories[selectedAgentId];
  history.push({ role: "user", content: question });
  renderChat();

  // Typing indicator
  const container = document.getElementById("chatMessages");
  const thinking = document.createElement("div");
  thinking.className = "msg msg-assistant thinking";
  thinking.innerHTML =
    '<div class="msg-bubble"><span class="dots"><span></span><span></span><span></span></span></div>';
  container.appendChild(thinking);
  container.scrollTop = container.scrollHeight;

  try {
    const res = await api("POST", `/agents/${selectedAgentId}/chat`, {
      question,
      chat_history: history.slice(-10).map(({ role, content }) => ({ role, content })),
    });
    history.push({ role: "assistant", content: res.answer, sources: res.sources });
  } catch (e) {
    history.push({ role: "assistant", content: "⚠️ Erro ao processar a resposta.", sources: [] });
  }

  thinking.remove();
  renderChat();
  setInputState(true);
  document.getElementById("chatInput").focus();
}

function clearChat() {
  if (!selectedAgentId) return;
  chatHistories[selectedAgentId] = [];
  renderChat();
}

function setInputState(enabled) {
  document.getElementById("chatInput").disabled = !enabled;
  document.getElementById("btnSend").disabled = !enabled;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(raw) {
  // Minimal markdown: bold, italic, inline-code, line breaks
  return esc(raw)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

function showToast(msg, error = false) {
  const t = document.createElement("div");
  t.className = `toast${error ? " toast-error" : ""}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Event Bindings ────────────────────────────────────────────────────────────

function bindEvents() {
  // Sidebar
  document.getElementById("btnNewAgent").addEventListener("click", openModal);

  // Modal
  document.getElementById("btnCancelModal").addEventListener("click", closeModal);
  document.getElementById("btnCreateAgent").addEventListener("click", createAgent);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modalOverlay")) closeModal();
  });
  document.getElementById("modalName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") createAgent();
  });

  // Settings modal
  document.getElementById("btnOpenSettings").addEventListener("click", openSettings);
  document.getElementById("btnCloseSettings").addEventListener("click", closeSettings);
  document.getElementById("settingsOverlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("settingsOverlay")) closeSettings();
  });
  document.getElementById("btnSaveAgent").addEventListener("click", saveAgent);
  document.getElementById("btnDeleteAgent").addEventListener("click", deleteAgent);

  // File upload
  document.getElementById("fileInput").addEventListener("change", (e) =>
    handleFiles(e.target.files)
  );
  const dz = document.getElementById("dropZone");
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });
  dz.addEventListener("click", (e) => {
    if (e.target.tagName !== "LABEL") document.getElementById("fileInput").click();
  });

  // Chat
  document.getElementById("btnClearChat").addEventListener("click", clearChat);
  document.getElementById("btnSend").addEventListener("click", sendMessage);
  document.getElementById("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

init();
