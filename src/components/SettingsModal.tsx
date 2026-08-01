import { useState } from 'react';
import { X, KeyRound, Github, Eye, EyeOff, Check, Loader2, ExternalLink, Database } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { validateSettings, OPENROUTER_FALLBACK, GEMINI_MODELS } from '@/lib/llm';
import { verifyToken } from '@/lib/github';
import { fetchSchema } from '@/lib/supabase';
import { ModelPicker } from '@/components/ModelPicker';
import type { Provider } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const { settings, set, setProvider } = useSettings();
  const [showKeys, setShowKeys] = useState(false);
  const [showPat, setShowPat] = useState(false);
  const [showSb, setShowSb] = useState(false);
  const [ghCheck, setGhCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [ghLogin, setGhLogin] = useState('');
  const [sbCheck, setSbCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [sbInfo, setSbInfo] = useState<string>('');

  if (!open) return null;

  const providers: { id: Provider; label: string; hint: string }[] = [
    { id: 'openrouter', label: 'OpenRouter', hint: 'Access many models with one key' },
    { id: 'gemini', label: 'Google AI Studio', hint: 'Free tier for Gemini 2.5' },
    { id: 'ollama', label: 'Ollama (local)', hint: 'Run models on your machine' },
  ];

  const validation = validateSettings(settings);

  async function checkGithub() {
    if (!settings.githubToken) return;
    setGhCheck('checking');
    const res = await verifyToken(settings.githubToken);
    if (res) {
      setGhCheck('ok');
      setGhLogin(res.login);
    } else {
      setGhCheck('fail');
      setGhLogin('');
    }
  }

  async function checkSupabase() {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;
    setSbCheck('checking');
    try {
      const snap = await fetchSchema(settings.supabaseUrl, settings.supabaseAnonKey);
      const summary = `${snap.tables.length} table${snap.tables.length !== 1 ? 's' : ''}, ${snap.views.length} view${snap.views.length !== 1 ? 's' : ''}, ${snap.buckets.length} bucket${snap.buckets.length !== 1 ? 's' : ''}`;
      setSbCheck('ok');
      setSbInfo(summary);
    } catch {
      setSbCheck('fail');
      setSbInfo('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl slide-up overflow-hidden"
        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <KeyRound size={18} style={{ color: 'var(--primary)' }} />
            Settings
          </h2>
          <button className="btn-ghost btn !px-2 !py-2" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Provider tabs */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-dim)' }}>AI PROVIDER</label>
            <div className="grid grid-cols-3 gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className="px-3 py-2.5 rounded-lg text-left transition-all border"
                  style={{
                    background: settings.provider === p.id ? 'var(--primary-dim)' : 'var(--bg-elev-2)',
                    borderColor: settings.provider === p.id ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: settings.provider === p.id ? 'var(--primary)' : 'var(--text)' }}>{p.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-mute)' }}>{p.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* API keys */}
          {settings.provider === 'openrouter' && (
            <Field label="OpenRouter API Key" link={{ href: 'https://openrouter.ai/keys', text: 'Get a key →' }}>
              <KeyInput value={settings.openrouterKey} onChange={(v) => set({ openrouterKey: v })} show={showKeys} onToggle={() => setShowKeys(!showKeys)} placeholder="sk-or-v1-..." />
            </Field>
          )}
          {settings.provider === 'gemini' && (
            <Field label="Google AI Studio API Key" link={{ href: 'https://aistudio.google.com/app/apikey', text: 'Get a key →' }}>
              <KeyInput value={settings.geminiKey} onChange={(v) => set({ geminiKey: v })} show={showKeys} onToggle={() => setShowKeys(!showKeys)} placeholder="AIza..." />
            </Field>
          )}
          {settings.provider === 'ollama' && (
            <>
              <Field label="Ollama Base URL">
                <input className="input mono" value={settings.ollamaBaseUrl} onChange={(e) => set({ ollamaBaseUrl: e.target.value })} placeholder="http://localhost:11434" />
              </Field>
              <Field label="Ollama Model">
                <input className="input mono" value={settings.ollamaModel} onChange={(e) => set({ ollamaModel: e.target.value })} placeholder="llama3.1" />
              </Field>
            </>
          )}

          {/* Model picker */}
          <Field label="Model">
            <ModelPicker
              provider={settings.provider}
              value={settings.model}
              onChange={(id) => set({ model: id })}
              fallback={settings.provider === 'gemini' ? GEMINI_MODELS : OPENROUTER_FALLBACK}
            />
          </Field>

          <div className="h-px" style={{ background: 'var(--border-soft)' }} />

          {/* GitHub */}
          <div>
            <label className="block text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
              <Github size={13} /> GITHUB PERSONAL ACCESS TOKEN
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <KeyInput value={settings.githubToken} onChange={(v) => { set({ githubToken: v }); setGhCheck('idle'); }} show={showPat} onToggle={() => setShowPat(!showPat)} placeholder="ghp_... or github_pat_..." mono />
              </div>
              <button className="btn btn-soft" onClick={checkGithub} disabled={!settings.githubToken || ghCheck === 'checking'}>
                {ghCheck === 'checking' ? <Loader2 size={14} className="animate-spin" /> : 'Verify'}
              </button>
            </div>
            {ghCheck === 'ok' && (
              <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                <Check size={13} /> Connected as <b>{ghLogin}</b>
              </p>
            )}
            {ghCheck === 'fail' && (
              <p className="text-xs mt-2" style={{ color: 'var(--error)' }}>Token invalid or expired.</p>
            )}
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-mute)' }}>
              Needs <code className="px-1 rounded" style={{ background: 'var(--bg-elev-3)' }}>repo</code> scope. Stored locally in your browser only.
            </p>
          </div>

          <div className="h-px" style={{ background: 'var(--border-soft)' }} />

          {/* Supabase Connection */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Database size={14} style={{ color: 'var(--primary)' }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Supabase Connection</span>
            </div>
            <div className="space-y-3">
              <Field label="Project URL">
                <input
                  className="input mono text-xs"
                  placeholder="https://xxxxx.supabase.co"
                  value={settings.supabaseUrl}
                  onChange={(e) => { set({ supabaseUrl: e.target.value }); setSbCheck('idle'); }}
                  spellCheck={false}
                />
              </Field>
              <Field label="Anon Key">
                <KeyInput value={settings.supabaseAnonKey} onChange={(v) => { set({ supabaseAnonKey: v }); setSbCheck('idle'); }} show={showSb} onToggle={() => setShowSb(!showSb)} placeholder="eyJhbGciOi..." mono />
              </Field>
              <button className="btn btn-soft text-xs" onClick={checkSupabase} disabled={!settings.supabaseUrl || !settings.supabaseAnonKey || sbCheck === 'checking'}>
                {sbCheck === 'checking' ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />} Test Connection
              </button>
              {sbCheck === 'ok' && (
                <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                  <Check size={13} /> Connected — {sbInfo}
                </p>
              )}
              {sbCheck === 'fail' && (
                <p className="text-xs" style={{ color: 'var(--error)' }}>Could not connect. Check the URL and anon key.</p>
              )}
              <p className="text-[11px]" style={{ color: 'var(--text-mute)' }}>
                Found in your Supabase Dashboard &gt; Project Settings &gt; API. The database browser uses these to list tables, views, and storage buckets.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev-2)' }}>
          <span className="text-xs" style={{ color: validation ? 'var(--warning)' : 'var(--text-mute)' }}>
            {validation ? validation : 'Settings saved automatically'}
          </span>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, link }: { label: string; children: React.ReactNode; link?: { href: string; text: string } }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{label}</label>
        {link && (
          <a href={link.href} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }}>
            {link.text} <ExternalLink size={11} />
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

function KeyInput({ value, onChange, show, onToggle, placeholder, mono }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string; mono?: boolean }) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={`input pr-10 ${mono ? 'mono' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost btn !p-1.5" onClick={onToggle} tabIndex={-1}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
