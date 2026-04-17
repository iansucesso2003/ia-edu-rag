"use client";

import type { Agent } from "@/lib/types";

interface SidebarProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewAgent: () => void;
}

export function Sidebar({ agents, selectedId, onSelect, onNewAgent }: SidebarProps) {
  return (
    <aside className="w-60 min-w-[200px] bg-[#0f172a] border-r border-[#1e293b] flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[#1e293b]">
        <h1 className="text-xl font-extrabold tracking-tight text-white mb-3">
          Brusqueta<span className="text-indigo-400">IA</span>
        </h1>
        <button
          onClick={onNewAgent}
          className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          + Novo Agente
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {agents.length === 0 ? (
          <p className="px-3 py-4 text-xs text-slate-500">Nenhum agente criado.</p>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 text-left transition-all border ${
                agent.id === selectedId
                  ? "bg-[#1e293b] border-indigo-500"
                  : "bg-transparent border-transparent hover:bg-[#1e293b]"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: agent.color }} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-white truncate">{agent.name}</span>
                <span className="text-xs text-slate-500">
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
