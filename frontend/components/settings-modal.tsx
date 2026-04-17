"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/lib/types";
import { X, Upload, FileText, Trash2 } from "lucide-react";

interface SettingsModalProps {
  agent: Agent;
  onClose: () => void;
  onSave: (data: { name: string; description: string; system_prompt: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onUpload: (files: File[]) => Promise<{ pdf_name: string; status: string; error?: string; chunks?: number; pages?: number }[]>;
  onRemoveDoc: (pdfName: string) => Promise<void>;
}

const inputCls = "border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 bg-slate-50 w-full outline-none focus:border-indigo-400 transition-colors";

export function SettingsModal({ agent, onClose, onSave, onDelete, onUpload, onRemoveDoc }: SettingsModalProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; ok: boolean; msg: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), description, system_prompt: systemPrompt }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este agente e todos os seus documentos? Esta ação não pode ser desfeita.")) return;
    await onDelete();
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setUploading(true);
    setUploadResults([]);
    setUploadProgress(`Enviando ${pdfs.length} arquivo${pdfs.length > 1 ? "s" : ""}…`);
    try {
      setUploadProgress("Processando em background, pode fechar este modal…");
      const results = await onUpload(pdfs);
      setUploadProgress("");
      setUploadResults(results.map((r) => ({
        name: r.pdf_name,
        ok: r.status === "ok",
        msg: r.status === "ok" ? `${r.chunks} chunks · ${r.pages} págs` : r.error ?? "Erro",
      })));
    } catch {
      setUploadProgress("");
      setUploadResults([{ name: "Upload", ok: false, msg: "Falha no upload" }]);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-w-[92vw] max-h-[90vh] overflow-y-auto p-7 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Configurar Agente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Descrição</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-baseline gap-2">
            System Prompt
            <span className="text-xs font-normal normal-case text-slate-400">Use {"{context}"} para posicionar os documentos.</span>
          </label>
          <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={6} className="font-mono text-xs" />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Documentos</p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300"
            }`}>
            <Upload className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
            <p className="text-sm text-slate-500">
              Arraste PDFs aqui ou <span className="text-indigo-500 underline">clique para selecionar</span>
            </p>
            <input ref={fileInputRef} type="file" multiple accept=".pdf" className="hidden"
              onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {uploading && uploadProgress && (
            <p className="text-xs text-slate-500 mt-2 animate-pulse">{uploadProgress}</p>
          )}
          {uploadResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {uploadResults.map((r, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${r.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {r.name}: {r.msg}
                </div>
              ))}
            </div>
          )}

          {agent.documents.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 max-h-44 overflow-y-auto">
              {agent.documents.map((doc) => (
                <div key={doc.pdf_name} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{doc.pdf_name}</p>
                    <p className="text-xs text-slate-400">{doc.pages} pág · {doc.chunks} chunks</p>
                  </div>
                  <button onClick={() => onRemoveDoc(doc.pdf_name)}
                    className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {agent.documents.length === 0 && !uploading && (
            <p className="text-xs text-slate-400 mt-2">Nenhum documento indexado.</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Button variant="outline" onClick={handleDelete}
            className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 gap-1.5">
            <Trash2 className="w-4 h-4" />
            Excluir Agente
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
