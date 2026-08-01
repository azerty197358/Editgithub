import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, Loader2, Gift, ChevronDown } from 'lucide-react';

export interface CatalogModel {
  id: string;
  name: string;
  context_length: number;
  free: boolean;
  promptPrice: number;
  completionPrice: number;
  modality?: string;
}

interface Props {
  provider: 'openrouter' | 'gemini' | 'ollama';
  value: string;
  onChange: (id: string) => void;
  /** static fallback list when live fetch is unavailable */
  fallback: CatalogModel[];
  ollamaModels?: string[];
}

export function ModelPicker({ provider, value, onChange, fallback, ollamaModels }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<CatalogModel[]>(fallback);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Live fetch OpenRouter catalog
  useEffect(() => {
    if (provider !== 'openrouter') { setModels(fallback); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('https://openrouter.ai/api/v1/models')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const data: CatalogModel[] = (j.data || []).map((m: { id: string; name?: string; context_length?: number; pricing?: { prompt?: string | number; completion?: string | number }; architecture?: { modality?: string } }) => ({
          id: m.id,
          name: m.name || m.id,
          context_length: m.context_length || 0,
          free: m.id.includes(':free') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0),
          promptPrice: Number(m.pricing?.prompt ?? 0),
          completionPrice: Number(m.pricing?.completion ?? 0),
          modality: m.architecture?.modality,
        }));
        data.sort((a, b) => {
          // free first, then alphabetical
          if (a.free !== b.free) return a.free ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setModels(data);
      })
      .catch(() => { if (!cancelled) setError('Could not load model list'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [provider, fallback]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    let list = models;
    if (freeOnly) list = list.filter((m) => m.free);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
    }
    return list;
  }, [models, query, freeOnly]);

  const selected = models.find((m) => m.id === value) || fallback.find((m) => m.id === value) || null;

  if (provider === 'ollama') {
    return (
      <div className="relative" ref={ref}>
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Default ({ollamaModels?.[0] || 'llama3.1'})</option>
          {(ollamaModels || []).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="input flex items-center justify-between text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate flex items-center gap-2">
          {selected ? (
            <>
              {selected.free && <Gift size={13} style={{ color: 'var(--success)' }} />}
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-mute)' }}>Default model</span>
          )}
        </span>
        <ChevronDown size={15} style={{ color: 'var(--text-mute)' }} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border shadow-2xl slide-up overflow-hidden" style={{ background: 'var(--bg-elev-2)', borderColor: 'var(--border)' }}>
          {/* Search + filter */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-mute)' }} />
              <input
                className="input pl-8 text-xs"
                placeholder="Search models..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                className="text-xs px-2 py-1 rounded-md flex items-center gap-1.5 transition-colors"
                style={{ background: freeOnly ? 'var(--success)' : 'var(--bg-elev-3)', color: freeOnly ? '#fff' : 'var(--text-dim)' }}
                onClick={() => setFreeOnly(!freeOnly)}
              >
                <Gift size={12} /> Free only
              </button>
              <span className="text-[11px]" style={{ color: 'var(--text-mute)' }}>
                {loading ? 'loading...' : `${filtered.length} model${filtered.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-mute)' }} /></div>
            )}
            {!loading && error && (
              <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-mute)' }}>{error}. Using fallback list.</div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-mute)' }}>No models match "{query}"</div>
            )}
            {!loading && filtered.map((m) => (
              <button
                key={m.id}
                className="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-elev-3)]"
                onClick={() => { onChange(m.id); setOpen(false); setQuery(''); }}
              >
                <span className="mt-0.5 shrink-0">
                  {m.id === value ? <Check size={13} style={{ color: 'var(--primary)' }} /> : <span className="block w-[13px]" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{m.name}</span>
                    {m.free && <span className="chip shrink-0" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}><Gift size={9} /> FREE</span>}
                  </span>
                  <span className="text-[10px] mt-0.5 block truncate mono" style={{ color: 'var(--text-mute)' }}>
                    {m.id} · {formatCtx(m.context_length)}
                    {!m.free && m.promptPrice > 0 && ` · $${fmtPrice(m.promptPrice)}/$${fmtPrice(m.completionPrice)} per 1M`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCtx(n: number): string {
  if (!n) return 'unknown ctx';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M ctx`;
  if (n >= 1000) return `${Math.round(n / 1000)}K ctx`;
  return `${n} ctx`;
}

function fmtPrice(p: number): string {
  if (p === 0) return '0';
  if (p < 0.001) return p.toExponential(1);
  return p.toFixed(4);
}
