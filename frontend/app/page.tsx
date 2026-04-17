"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { CreateAgentModal } from "@/components/create-agent-modal";
import { SettingsModal } from "@/components/settings-modal";
import { request } from "@/lib/api";
import type { Agent, ChatMessage, Source } from "@/lib/types";

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    request<Agent[]>("GET", "/agents")
      .then(setAgents)
      .catch(() => showToast("Erro ao carregar agentes.", true));
  }, [showToast]);

  const currentMessages = selectedAgent ? (chatHistories[selectedAgent.id] ?? []) : [];

  const handleCreateAgent = async (data: { name: string; description: string; system_prompt: string; color: string }) => {
    const agent = await request<Agent>("POST", "/agents", data);
    setAgents((prev) => [...prev, agent]);
    setSelectedAgent(agent);
    setShowCreate(false);
  };

  const handleSaveAgent = async (data: { name: string; description: string; system_prompt: string }) => {
    if (!selectedAgent) return;
    const updated = await request<Agent>("PATCH", `/agents/${selectedAgent.id}`, data);
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    setSelectedAgent((prev) => (prev ? { ...prev, ...updated } : prev));
    setShowSettings(false);
    showToast("Agente salvo!");
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;
    await request("DELETE", `/agents/${selectedAgent.id}`);
    setAgents((prev) => prev.filter((a) => a.id !== selectedAgent.id));
    setChatHistories((prev) => { const n = { ...prev }; delete n[selectedAgent.id]; return n; });
    setSelectedAgent(null);
    setShowSettings(false);
  };

  const handleUpload = async (files: File[]) => {
    if (!selectedAgent) return [];
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    const { job_id } = await request<{ job_id: string; total: number }>(
      "POST", `/agents/${selectedAgent.id}/upload`, formData
    );

    // Poll until processing is complete (handles Railway timeout)
    while (true) {
      await new Promise((r) => setTimeout(r, 2500));
      const job = await request<{ status: string; results: { pdf_name: string; status: string; error?: string; chunks?: number; pages?: number }[]; done: number; total: number }>(
        "GET", `/agents/${selectedAgent.id}/jobs/${job_id}`
      );
      if (job.status === "done") {
        const updated = await request<Agent>("GET", `/agents/${selectedAgent.id}`);
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setSelectedAgent(updated);
        return job.results;
      }
    }
  };

  const handleRemoveDoc = async (pdfName: string) => {
    if (!selectedAgent) return;
    await request("DELETE", `/agents/${selectedAgent.id}/documents/${encodeURIComponent(pdfName)}`);
    const updated = { ...selectedAgent, documents: selectedAgent.documents.filter((d) => d.pdf_name !== pdfName) };
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAgent(updated);
  };

  const handleSendMessage = async (question: string) => {
    if (!selectedAgent || isLoading) return;
    const agentId = selectedAgent.id;
    setIsLoading(true);
    const history = chatHistories[agentId] ?? [];
    const newHistory: ChatMessage[] = [...history, { role: "user", content: question }];
    setChatHistories((prev) => ({ ...prev, [agentId]: newHistory }));
    try {
      const res = await request<{ answer: string; sources: Source[] }>(
        "POST", `/agents/${agentId}/chat`,
        { question, chat_history: newHistory.slice(-10).map(({ role, content }) => ({ role, content })) }
      );
      setChatHistories((prev) => ({
        ...prev,
        [agentId]: [...(prev[agentId] ?? []), { role: "assistant", content: res.answer, sources: res.sources }],
      }));
    } catch {
      setChatHistories((prev) => ({
        ...prev,
        [agentId]: [...(prev[agentId] ?? []), { role: "assistant", content: "⚠️ Erro ao processar a resposta.", sources: [] }],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      <Sidebar
        agents={agents}
        selectedId={selectedAgent?.id ?? null}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onSelect={(id) => setSelectedAgent(agents.find((a) => a.id === id) ?? null)}
        onNewAgent={() => setShowCreate(true)}
      />
      <ChatPanel
        agent={selectedAgent}
        messages={currentMessages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onClearChat={() => selectedAgent && setChatHistories((prev) => ({ ...prev, [selectedAgent.id]: [] }))}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showCreate && (
        <CreateAgentModal onClose={() => setShowCreate(false)} onCreate={handleCreateAgent} />
      )}
      {showSettings && selectedAgent && (
        <SettingsModal
          agent={selectedAgent}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveAgent}
          onDelete={handleDeleteAgent}
          onUpload={handleUpload}
          onRemoveDoc={handleRemoveDoc}
        />
      )}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg text-sm text-white shadow-lg ${toast.error ? "bg-red-500" : "bg-slate-800"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
