import type { ParsedAction, SearchReplaceBlock } from '@/types';

/**
 * Parse AI response content for file operations.
 * Supports:
 *  1. XML-like tags: <file path="src/Foo.tsx">...</file> (also <create>, <modify>, <delete>)
 *  2. Markdown fenced block with path: ```tsx path="src/Foo.tsx" ... ```
 *  3. SEARCH/REPLACE blocks inside <file> tags for surgical edits:
 *     <<<<<<< SEARCH
 *     exact existing code
 *     =======
 *     new code
 *     >>>>>>> REPLACE
 *  4. Delete tags: <delete path="..."/>
 */
// Clean, safe pattern — captures tag name, path, and content in one pass.
// Used by parseActions and exported for streaming completeness checks.
export const FILE_REGEX = /<(file|create|modify|write|code|edit|update)\s+([^>]*)>([\s\S]*?)<\/\1>/gi;
const TAG_OPEN = /<(?:file|create|modify|write|code|edit|update)\b([^>]*)>/gi;
const DEL_TAG = /<delete\s+(?:path|file|filename|name)=["']([^"']+)["']\s*\/?>/gi;
const FENCE = /```([\w-]*)[\s:]*([^\n]*)\n([\s\S]*?)```/gi;
const SR_BLOCK = /<{7}\s*SEARCH\s*\n([\s\S]*?)\n={7}\s*\n([\s\S]*?)\n>{7}\s*REPLACE/g;
const SR_MARKER = /<{7}\s*SEARCH/;

function getAttr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:${name}|path|file|filename|name)=["']?([^"' \t\r\n>]+)["']?`, 'i').exec(attrs);
  if (m) return m[1];
  const m2 = new RegExp(`${name}[:=]([^ \t\r\n>]+)`, 'i').exec(attrs);
  return m2 ? m2[1].replace(/['"]/g, '') : null;
}

function extractPathFromInfo(info: string): string | null {
  if (!info) return null;
  const attrMatch = /(?:path|file|filename|name)=["']?([^"' \t\r\n>]+)["']?/i.exec(info);
  if (attrMatch) return attrMatch[1];
  const pathMatch = /\b([\w./-]+\.[a-zA-Z0-9]{1,6})\b/.exec(info);
  if (pathMatch) return pathMatch[1];
  return null;
}

export function parseActions(content: string, knownPaths: string[] = []): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const known = new Set(knownPaths);

  // 1. XML-like tags (<file>, <create>, <modify>, <write>, <code`, <edit>, <update>)
  let m: RegExpExecArray | null;
  TAG_OPEN.lastIndex = 0;
  while ((m = TAG_OPEN.exec(content)) !== null) {
    const attrs = m[1] || '';
    const path = getAttr(attrs, 'path') || getAttr(attrs, 'file') || getAttr(attrs, 'filename') || getAttr(attrs, 'name');
    if (!path) continue;
    const closeIdx = indexOfCloseTag(content, m.index + m[0].length);
    if (closeIdx === -1) continue;
    const inner = content.slice(m.index + m[0].length, closeIdx);
    const cleaned = cleanInner(inner);
    const isKnown = known.has(path);

    if (SR_MARKER.test(cleaned)) {
      const blocks = extractSearchReplace(cleaned);
      if (blocks.length > 0) {
        actions.push({ type: 'modify', path, searchReplace: blocks });
        TAG_OPEN.lastIndex = closeIdx + closeTagLen(content, closeIdx);
        continue;
      }
    }

    actions.push({ type: isKnown ? 'modify' : 'create', path, content: cleaned });
    TAG_OPEN.lastIndex = closeIdx + closeTagLen(content, closeIdx);
  }

  // 2. Fenced blocks with path/file attribute or inline path in info string
  FENCE.lastIndex = 0;
  while ((m = FENCE.exec(content)) !== null) {
    const lang = m[1] || '';
    const info = m[2] || '';
    const path = extractPathFromInfo(info) || extractPathFromInfo(lang);
    if (!path) continue;
    const fencedContent = m[3].replace(/\n$/, '');
    if (SR_MARKER.test(fencedContent)) {
      const blocks = extractSearchReplace(fencedContent);
      if (blocks.length > 0) {
        actions.push({ type: 'modify', path, searchReplace: blocks });
        continue;
      }
    }
    actions.push({ type: known.has(path) ? 'modify' : 'create', path, content: fencedContent });
  }

  // 2b. Fenced blocks WITHOUT path attribute but preceded by a path hint line
  const FENCE_NO_PATH = /```([\w-]*)\s*\n([\s\S]*?)```/g;
  const PATH_HINT = /(?:file|path|create|modify|update|edit|write)[:\s]+[`'"]?([\w./-]+\.\w{1,5})[`'"]?/i;
  FENCE_NO_PATH.lastIndex = 0;
  while ((m = FENCE_NO_PATH.exec(content)) !== null) {
    const blockStart = m.index;
    const precedingText = content.slice(Math.max(0, blockStart - 200), blockStart);
    const hintMatch = precedingText.match(PATH_HINT);
    if (!hintMatch) continue;
    const path = hintMatch[1];
    if (actions.some((a) => a.path === path)) continue;
    const fencedContent = m[2].replace(/\n$/, '');
    if (SR_MARKER.test(fencedContent)) {
      const blocks = extractSearchReplace(fencedContent);
      if (blocks.length > 0) {
        actions.push({ type: 'modify', path, searchReplace: blocks });
        continue;
      }
    }
    actions.push({ type: known.has(path) ? 'modify' : 'create', path, content: fencedContent });
  }

  // 3. Delete tags
  DEL_TAG.lastIndex = 0;
  while ((m = DEL_TAG.exec(content)) !== null) {
    const path = getAttr(m[0], 'path') || getAttr(m[0], 'file') || getAttr(m[0], 'filename') || getAttr(m[0], 'name');
    if (path) actions.push({ type: 'delete', path, content: '' });
  }

  const map = new Map<string, ParsedAction>();
  for (const a of actions) map.set(a.path, a);
  return [...map.values()];
}

function extractSearchReplace(raw: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  SR_BLOCK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SR_BLOCK.exec(raw)) !== null) {
    blocks.push({
      search: m[1].replace(/\n$/, ''),
      replace: m[2].replace(/\n$/, ''),
    });
  }
  return blocks;
}

function indexOfCloseTag(content: string, start: number): number {
  const close = content.indexOf('</file>', start);
  const closeC = content.indexOf('</create>', start);
  const closeM = content.indexOf('</modify>', start);
  const closeW = content.indexOf('</write>', start);
  const candidates = [close, closeC, closeM, closeW].filter((i) => i !== -1);
  if (candidates.length === 0) return -1;
  return Math.min(...candidates);
}

function closeTagLen(_content: string, idx: number): number {
  const slice = _content.slice(idx, idx + 12);
  if (slice.startsWith('</file>')) return 7;
  if (slice.startsWith('</create>')) return 9;
  if (slice.startsWith('</modify>')) return 9;
  if (slice.startsWith('</write>')) return 8;
  return 7;
}

function cleanInner(inner: string): string {
  let s = inner;
  if (s.startsWith('\n')) s = s.slice(1);
  if (s.endsWith('\n')) s = s.slice(0, -1);
  return s;
}

/** Apply SEARCH/REPLACE blocks to existing file content. Returns null if a SEARCH block isn't found. */
export function applySearchReplace(existing: string, blocks: SearchReplaceBlock[]): { result: string; failedBlock: number } | null {
  let content = existing;
  for (let i = 0; i < blocks.length; i++) {
    const idx = content.indexOf(blocks[i].search);
    if (idx === -1) return { result: content, failedBlock: i };
    content = content.slice(0, idx) + blocks[i].replace + content.slice(idx + blocks[i].search.length);
  }
  return { result: content, failedBlock: -1 };
}

/** Strip file-action blocks from assistant text for clean display. */
export function stripFileBlocks(content: string): string {
  let out = content;
  out = out.replace(/<(?:file|create|modify|write)\b[^>]*>[\s\S]*?<\/(?:file|create|modify|write)>/gi, '');
  out = out.replace(/<delete\s+path=["'][^"']+["']\s*\/?>/gi, '');
  out = out.replace(/(```[\w-]*)\s*path=["'][^"']+["']\s*/gi, '$1\n');
  return out.trim();
}

/**
 * Check whether all opened file-action tags in the content are properly closed.
 * Used during streaming to determine if a file block is complete and safe to apply.
 * Returns false if any <file>/<create>/<modify>/<write> tag lacks its matching close tag,
 * or if any SEARCH/REPLACE block is missing its >>>>>>> REPLACE terminator.
 */
export function isBlockComplete(content: string): boolean {
  // Use the clean, safe regex pattern to find all complete file blocks
  const fileRegex = /<(file|create|modify|write)\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/\1>/gi;
  const completeMatches: { path: string; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = fileRegex.exec(content)) !== null) {
    completeMatches.push({ path: m[2], end: m.index + m[0].length });
  }

  // Count total opening tags (may be unclosed during streaming)
  const allOpenTags = content.match(/<(file|create|modify|write)\s+path=["'][^"']+["']\s*>/gi) || [];
  // If there are more open tags than complete matches, some are still unclosed
  if (allOpenTags.length > completeMatches.length) return false;

  // Count fenced code blocks: odd number of ``` means unclosed
  const allFences = content.match(/```/g);
  if (allFences && allFences.length % 2 !== 0) return false;

  // Check SEARCH/REPLACE blocks: every <<<<<<< SEARCH must have a >>>>>>> REPLACE
  const searchCount = (content.match(/<{7}\s*SEARCH/g) || []).length;
  const replaceCount = (content.match(/>{7}\s*REPLACE/g) || []).length;
  if (searchCount !== replaceCount) return false;

  return true;
}
