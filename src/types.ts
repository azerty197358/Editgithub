export type Provider = 'openrouter' | 'gemini' | 'ollama';

export interface ModelOption {
  id: string;
  label: string;
  provider: Provider;
}

export interface Settings {
  provider: Provider;
  openrouterKey: string;
  geminiKey: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  githubToken: string;
  model: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface VFile {
  path: string;
  content: string;
  originalContent: string;
  status: 'new' | 'modified' | 'deleted' | 'unchanged';
  binary?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  ts: number;
  pending?: boolean;
  error?: boolean;
  fileOps?: FileOp[];
}

export interface FileOp {
  type: 'create' | 'modify' | 'delete';
  path: string;
  preview?: string;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  url: string;
  private: boolean;
}

export interface RepoMeta {
  owner: string;
  repo: string;
  branch: string;
}

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export interface ParsedAction {
  type: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
  searchReplace?: SearchReplaceBlock[];
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  subject: string;
  author: string;
  date: string;
  url: string;
}
