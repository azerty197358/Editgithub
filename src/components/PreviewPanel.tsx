import { useEffect, useRef, useState, useCallback } from 'react';
import { Eye, RefreshCw, Loader2, AlertCircle, ExternalLink, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useVfs } from '@/store/vfs';
import { bundlePreview } from '@/lib/preview';

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  desktop: 0,    // full width
  tablet: 768,
  mobile: 390,
};

export function PreviewPanel() {
  const { files } = useVfs();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [srcDoc, setSrcDoc] = useState('');

  // Rebuild preview when files change (debounced)
  const rebuild = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const result = bundlePreview(files);
      setSrcDoc(result.html);
      if (result.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [files]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      rebuild();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [files, refreshKey, rebuild]);

  // Listen for console errors from the iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'preview-error') {
        setError(e.data.message);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const hasFiles = Object.values(files).filter((f) => f.status !== 'deleted').length > 0;
  const viewportWidth = VIEWPORT_WIDTHS[viewport];

  if (!hasFiles) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--bg-elev-2)' }}>
            <Eye size={24} style={{ color: 'var(--text-mute)' }} />
          </div>
          <h3 className="text-sm font-semibold mb-1">No files to preview</h3>
          <p className="text-xs" style={{ color: 'var(--text-mute)' }}>
            Ask the AI to create an app, or clone a repository to see a live preview here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev)' }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--bg-elev-2)' }}>
            <ViewportBtn active={viewport === 'desktop'} onClick={() => setViewport('desktop')} icon={<Monitor size={13} />} label="Desktop" />
            <ViewportBtn active={viewport === 'tablet'} onClick={() => setViewport('tablet')} icon={<Tablet size={13} />} label="Tablet" />
            <ViewportBtn active={viewport === 'mobile'} onClick={() => setViewport('mobile')} icon={<Smartphone size={13} />} label="Mobile" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-mute)' }} />}
          <button
            className="btn btn-ghost text-xs !py-1.5 flex items-center gap-1.5"
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh preview"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn btn-ghost text-xs !py-1.5 flex items-center gap-1.5"
            onClick={() => {
              const w = window.open('', '_blank');
              if (w) {
                w.document.write(srcDoc);
                w.document.close();
              }
            }}
            title="Open in new tab"
          >
            <ExternalLink size={13} /> Open
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3 py-2 flex items-start gap-2 text-xs border-b" style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.08)', borderColor: 'var(--border-soft)' }}>
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="mono break-all">{error}</span>
        </div>
      )}

      {/* Preview iframe */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div
          className="bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300"
          style={{
            width: viewportWidth > 0 ? `${viewportWidth}px` : '100%',
            height: '100%',
            maxWidth: '100%',
          }}
        >
          <iframe
            ref={iframeRef}
            key={refreshKey}
            srcDoc={srcDoc}
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}

function ViewportBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all"
      style={{
        background: active ? 'var(--bg-elev-3)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-mute)',
      }}
      title={label}
    >
      {icon}
    </button>
  );
}
