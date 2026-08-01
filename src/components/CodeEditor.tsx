import Editor, { loader } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useVfs } from '@/store/vfs';

loader.init().then((monaco) => {
  monaco.editor.defineTheme('opencode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5a6378', fontStyle: 'italic' },
      { token: 'string', foreground: '7ee787' },
      { token: 'number', foreground: 'f0883e' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'type', foreground: '79c0ff' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'variable', foreground: 'e6e9f2' },
    ],
    colors: {
      'editor.background': '#0b0e14',
      'editor.foreground': '#e6e9f2',
      'editorLineNumber.foreground': '#3a4358',
      'editorLineNumber.activeForeground': '#8b93a7',
      'editor.selectionBackground': '#1d3a6b',
      'editor.lineHighlightBackground': '#111623',
      'editorCursor.foreground': '#3b82f6',
      'editorIndentGuide.background': '#161c2c',
      'editorIndentGuide.activeBackground': '#232c42',
      'editorWidget.background': '#111623',
      'editorWidget.border': '#232c42',
      'scrollbarSlider.background': '#232c4288',
      'editorGutter.background': '#0b0e14',
    },
  });
});

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    mjs: 'javascript', cjs: 'javascript', json: 'json', md: 'markdown',
    mdx: 'markdown', html: 'html', css: 'css', scss: 'scss', sass: 'sass',
    py: 'python', go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'cpp',
    cs: 'csharp', rb: 'ruby', php: 'php', vue: 'html', svelte: 'html',
    yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini', sh: 'shell',
    bash: 'shell', sql: 'sql', graphql: 'graphql', gql: 'graphql',
  };
  return map[ext] || 'plaintext';
}

interface Props {
  readOnly?: boolean;
}

export function CodeEditor({ readOnly }: Props) {
  const { files, activeFile, writeFile } = useVfs();
  const file = activeFile ? files[activeFile] : null;
  const monacoRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    // noop — kept for future cursor tracking
  }, [activeFile]);

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#0b0e14' }}>
        <p className="text-sm" style={{ color: 'var(--text-mute)' }}>Select a file to edit</p>
      </div>
    );
  }

  if (file.status === 'deleted') {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#0b0e14' }}>
        <p className="text-sm" style={{ color: 'var(--error)' }}>This file is marked for deletion</p>
      </div>
    );
  }

  return (
    <Editor
      key={file.path}
      height="100%"
      theme="opencode-dark"
      path={file.path}
      language={langFromPath(file.path)}
      value={file.content}
      onChange={(val) => {
        if (!readOnly && val !== undefined) writeFile(file.path, val);
      }}
      onMount={(editor, monaco) => {
        monacoRef.current = editor;
        monaco.editor.setTheme('opencode-dark');
      }}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        renderWhitespace: 'selection',
        tabSize: 2,
        readOnly,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on',
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
      }}
    />
  );
}
