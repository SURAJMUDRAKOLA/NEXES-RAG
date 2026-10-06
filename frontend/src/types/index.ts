// NEXUS — shared TypeScript types

export type DocStatus = 'queued' | 'parsing' | 'chunking' | 'embedding' | 'ready' | 'error';
export type DocType   = 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'image' | 'audio' | 'video' | 'txt' | 'other';
export type Role      = 'user' | 'assistant' | 'system';

export interface User {
  id:           string;
  email:        string;
  display_name: string | null;
  avatar_url:   string | null;
  created_at:   string;
}

export interface Document {
  id:            string;
  user_id:       string;
  name:          string;
  original_name: string | null;
  doc_type:      DocType;
  status:        DocStatus;
  progress:      number;       // 0–100
  page_count:    number | null;
  file_size:     number | null; // bytes
  storage_path:  string | null;
  summary:       string | null;
  auto_topics:   string[] | null;
  error_message: string | null;
  indexed_at:    string | null;
  created_at:    string;
}

export interface Session {
  id:          string;
  user_id:     string;
  title:       string;
  doc_ids:     string[];
  last_active: string;
  created_at:  string;
}

export interface SourceChunk {
  id:         number;
  doc_id:     string;
  doc_name?:  string;
  content:    string;
  snippet?:   string;
  page_num?:  number | null;
  slide_num?: number | null;
  modality?:  string;
  similarity: number;
  score?:     number;
  chunk_id?:  string;
}

export interface Message {
  id:                string;
  session_id:        string;
  role:              Role;
  content:           string;
  sources?:          SourceChunk[];
  model_used?:       string;
  prompt_tokens?:    number;
  completion_tokens?: number;
  latency_ms?:       number;
  feedback?:         1 | -1 | null;
  isStreaming?:      boolean;
  inlineDoc?:        Document | null;  // attached document
  created_at:        string;
}

export type StreamEvent =
  | { type: 'token';             data: string }
  | { type: 'sources';           sources: SourceChunk[] }
  | { type: 'related_questions'; questions: string[] }
  | { type: 'key_points';        points: string[] }
  | { type: 'done';              message_id: string; latency_ms: number; model: string; chunk_count: number; intent?: string }
  | { type: 'error';             message: string };

export interface UIState {
  sidebarExpanded:    boolean;
  insightsPanelOpen:  boolean;
  commandPaletteOpen: boolean;
  settingsOpen:       boolean;
  authModalOpen:      boolean;
  uploadDragOver:     boolean;
}

/** File being uploaded — tracks in-progress uploads before they get a server ID */
export interface UploadingFile {
  id:       string;
  file:     File;
  status:   DocStatus;
  progress: number;
  error?:   string;
}

/** A single node in the UMAP knowledge map */
export interface UMAPNode {
  id:    string;
  label: string;
  type:  DocType;
  x:     number;
  y:     number;
  z?:    number;
}
