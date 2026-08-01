import * as React from 'react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

export function Markdown({ content }: { content: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: (props) => <CodeBlock {...props} />,
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? <code {...props}>{children}</code> : <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock(props: React.HTMLAttributes<HTMLPreElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const raw = extractText(props.children);

  return (
    <div className="relative group">
      <button
        className="absolute right-2 top-2 btn btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => { navigator.clipboard.writeText(raw); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      >
        {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
      </button>
      <pre {...props}>{props.children}</pre>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const props = (node as React.ReactElement<{ children?: React.ReactNode }>).props;
    return extractText(props.children);
  }
  return '';
}
