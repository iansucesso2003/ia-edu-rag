export interface AgentDocument {
  pdf_name: string;
  pages: number;
  chunks: number;
  has_image: boolean;
  status: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  color: string;
  documents: AgentDocument[];
  created_at: string;
}

export interface Source {
  pdf_name: string;
  page_num: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}
