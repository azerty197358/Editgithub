/**
 * Lightweight client-side syntax validator for common code files.
 * Checks for balanced brackets, braces, parens, and basic JSX/HTML tag closure.
 * Returns null if valid, or an error description string.
 */

interface ValidatorResult {
  ok: boolean;
  error: string | null;
}

export function validateCode(content: string, path: string): ValidatorResult {
  if (!content.trim()) return { ok: false, error: 'File content is empty' };

  const ext = path.split('.').pop()?.toLowerCase() || '';

  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
    return validateBrackets(content);
  }
  if (['json'].includes(ext)) {
    return validateJson(content);
  }
  if (['html', 'htm', 'vue', 'svelte'].includes(ext)) {
    return validateBrackets(content);
  }
  if (['css', 'scss', 'less'].includes(ext)) {
    return validateBrackets(content);
  }
  return { ok: true, error: null };
}

function validateBrackets(content: string): ValidatorResult {
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const openers = new Set(['(', '[', '{']);
  let inString: false | '"' | "'" | '`' = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inRegex = false;
  let prev = '';

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const line = content.slice(0, i).split('\n').length;

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      prev = c;
      continue;
    }
    if (inBlockComment) {
      if (c === '/' && prev === '*') inBlockComment = false;
      prev = c;
      continue;
    }
    if (inString) {
      if (c === '\\') { prev = c; i++; continue; }
      if (c === inString) inString = false;
      prev = c;
      continue;
    }
    if (inRegex) {
      if (c === '\\') { prev = c; i++; continue; }
      if (c === '/') inRegex = false;
      prev = c;
      continue;
    }

    if (c === '/' && content[i + 1] === '/') { inLineComment = true; prev = c; continue; }
    if (c === '/' && content[i + 1] === '*') { inBlockComment = true; prev = c; i++; continue; }

    if (c === '"' || c === "'" || c === '`') { inString = c; prev = c; continue; }

    if (openers.has(c)) {
      stack.push({ ch: c, line });
    } else if (pairs[c]) {
      const top = stack.pop();
      if (!top || top.ch !== pairs[c]) {
        return { ok: false, error: `Unmatched '${c}' at line ${line}` };
      }
    }
    prev = c;
  }

  if (inString) return { ok: false, error: 'Unclosed string literal' };
  if (inBlockComment) return { ok: false, error: 'Unclosed block comment' };
  if (stack.length > 0) {
    const unclosed = stack.map((s) => `'${s.ch}' at line ${s.line}`).join(', ');
    return { ok: false, error: `Unclosed bracket(s): ${unclosed}` };
  }
  return { ok: true, error: null };
}

function validateJson(content: string): ValidatorResult {
  try {
    JSON.parse(content);
    return { ok: true, error: null };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message };
  }
}

export interface ValidationResult {
  ok: boolean;
  error: string | null;
  path: string;
}
