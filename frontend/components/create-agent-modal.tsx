"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CreateAgentModalProps {
  onClose: () => void;
  onCreate: (data: { name: string; description: string; system_prompt: string; color: string }) => Promise<void>;
}

const inputCls = "border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 bg-slate-50 w-full outline-none focus:border-indigo-400 transition-colors";

export function CreateAgentModal({ onClose, onCreate }: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    setLoading(true);
    setError("");
    try {
      await onCreate({ name: name.trim(), description, system_prompt: systemPrompt, color });
    } catch {
      setError("Erro ao criar agente. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[92vw] max-h-[90vh] overflow-y-auto p-7 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-800">Novo Agente</h2>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Nome *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Ex: Agente Jurídico" className={inputCls} autoFocus />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Descrição</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descrição" className={inputCls} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-baseline gap-2">
            System Prompt
            <span className="text-xs font-normal normal-case text-slate-400">Use {"{context}"} para posicionar os documentos.</span>
          </label>
          <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Escreva as instruções do agente…" rows={5} className="font-mono text-xs" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Cor</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="w-11 h-9 border border-slate-200 rounded-lg cursor-pointer p-1 bg-transparent" />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 justify-end mt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Criando…" : "Criar Agente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
