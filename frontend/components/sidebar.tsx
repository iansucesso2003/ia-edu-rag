"use client";

import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import type { Agent } from "@/lib/types";

interface SidebarProps {
  agents: Agent[];
  selectedId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onNewAgent: () => void;
}

export function Sidebar({ agents, selectedId, isOpen, onToggle, onSelect, onNewAgent }: SidebarProps) {
  if (!isOpen) {
    return (
      <aside className="flex flex-col items-center py-3 gap-3 border-r border-white/5 bg-[#080d17] flex-shrink-0" style={{ width: 52 }}>
        <button
          onClick={onToggle}
          title="Expandir"
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-2 mt-1">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              title={agent.name}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                agent.id === selectedId ? "ring-1 ring-indigo-400/50 bg-white/5" : "hover:bg-white/5"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: agent.color }} />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col flex-shrink-0 border-r border-white/5 bg-[#080d17]" style={{ width: 240 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <h1 className="text-base font-extrabold tracking-tight text-white">
          Brusqueta<span className="text-indigo-400">IA</span>
        </h1>
        <button
          onClick={onToggle}
          title="Ocultar"
          className="w-7 h-7 flex items-center justify-center rounded-full text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New agent */}
      <div className="px-4 pb-3">
        <button
          onClick={onNewAgent}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full bg-indigo-500/90 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Agente
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/5 mb-2" />

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {agents.length === 0 ? (
          <p className="px-3 py-4 text-xs text-white/25 text-center">Nenhum agente criado.</p>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-0.5 text-left transition-all ${
                agent.id === selectedId
                  ? "bg-white/8 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: agent.color }} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{agent.name}</span>
                <span className="text-[11px] text-white/30">
                  {agent.documents.length} doc{agent.documents.length !== 1 ? "s" : ""}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
