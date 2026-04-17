"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, Settings2, Trash2, BookOpen, Upload, MessageSquare } from "lucide-react";
import type { Agent, ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  agent: Agent | null;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (question: string) => Promise<void>;
  onClearChat: () => void;
  onOpenSettings: () => void;
}

function useAutoResize(minH: number, maxH: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const adjust = useCallback(
    (reset?: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.style.height = `${minH}px`;
      if (!reset) el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
    },
    [minH, maxH]
  );
  useEffect(() => {
    if (ref.current) ref.current.style.height = `${minH}px`;
  }, [minH]);
  return { ref, adjust };
}

function renderMarkdown(raw: string) {
  return raw
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-white/10 px-1 rounded text-xs font-mono'>$1</code>")
    .replace(/\n/g, "<br>");
}

export function ChatPanel({ agent, messages, isLoading, onSendMessage, onClearChat, onOpenSettings }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const { ref: textareaRef, adjust } = useAutoResize(52, 150);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const send = async () => {
    if (!input.trim() || isLoading || !agent) return;
    const text = input.trim();
    setInput("");
    adjust(true);
    await onSendMessage(text);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!agent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0f172a] text-slate-500">
        <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-base font-medium text-slate-400">Selecione um agente para começar</p>
        <p className="text-sm mt-1 opacity-60">Escolha ou crie um agente na barra lateral</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col relative overflow-hidden"
      style={{
        backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black/55 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: agent.color }} />
          <span className="font-semibold text-white text-sm">{agent.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onClearChat}
            className="text-white/50 hover:text-white hover:bg-white/10 h-8 px-2 gap-1">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-xs">Limpar</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenSettings}
            className="text-white/50 hover:text-white hover:bg-white/10 h-8 w-8">
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages or empty state */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center pb-16 px-4">
            <h1 className="text-4xl font-semibold text-white drop-shadow">{agent.name}</h1>
            <p className="mt-2 text-neutral-300 text-sm text-center max-w-sm">
              {agent.description || "Faça uma pergunta sobre os documentos indexados."}
            </p>
            {agent.documents.length === 0 ? (
              <button onClick={onOpenSettings}
                className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-white/70 hover:bg-white/20 text-sm transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Adicionar documentos
              </button>
            ) : (
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                {agent.documents.map((doc) => (
                  <span key={doc.pdf_name}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-white/60 text-xs">
                    <BookOpen className="w-3 h-3" />
                    {doc.pdf_name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-indigo-500 text-white rounded-br-sm"
                    : "bg-black/60 backdrop-blur-sm text-white border border-white/10 rounded-bl-sm"
                )}>
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/10">
                      {msg.sources.map((s, j) => (
                        <span key={j} className="text-xs bg-indigo-500/20 text-indigo-200 border border-indigo-400/20 px-2 py-0.5 rounded-full">
                          📄 {s.pdf_name} p.{s.page_num}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative z-10 px-4 pb-6 pt-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-black/60 backdrop-blur-md rounded-xl border border-white/20">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); adjust(); }}
              onKeyDown={onKeyDown}
              placeholder="Digite sua pergunta…"
              disabled={isLoading}
              className="w-full px-4 py-3 resize-none border-none bg-transparent text-white text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-neutral-400 min-h-[52px]"
              style={{ overflow: "hidden" }}
            />
            <div className="flex justify-end p-2">
              <Button onClick={send} disabled={!input.trim() || isLoading} size="icon"
                className={cn("h-8 w-8 rounded-lg transition-colors",
                  input.trim() && !isLoading
                    ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                    : "bg-neutral-700 text-neutral-500 pointer-events-none")}>
                <ArrowUpIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
