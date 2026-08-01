import type { VFile, RepoInfo, CommitInfo } from '@/types';

const API = 'https://api.github.com';

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export interface ParsedRepo {
  owner: string;
  repo: string;
}

export function parseRepoUrl(input: string): ParsedRepo | null {
  const m = input.match(/github\.com[:/]([^/]+)\/([^/\s.]+)(?:\.git)?$/i);
  if (m) return { owner: m[1], repo: m[2] };
  const shorthand = input.trim().match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] };
  return null;
}

/** List branches of a repo. */
export async function listBranches(token: string, owner: string, repo: string): Promise<string[]> {
  const r = await fetch(`${API}/repos/${owner}/${repo}/branches?per_page=100`, {
    headers: authHeaders(token),
  });
  if (!r.ok) throw new Error(`List branches failed: ${r.status}`);
  const data = (await r.json()) as { name: string }[];
  return data.map((b) => b.name);
}

/** Get default branch + meta. */
export async function getRepoMeta(token: string, owner: string, repo: string): Promise<RepoInfo> {
  const r = await fetch(`${API}/repos/${owner}/${repo}`, { headers: authHeaders(token) });
  if (r.status === 404) throw new Error('Repository not found. Check the URL and that your token has access.');
  if (!r.ok) throw new Error(`Repo lookup failed: ${r.status}`);
  const d = (await r.json()) as {
    default_branch: string;
    html_url: string;
    private: boolean;
  };
  return {
    owner,
    repo,
    branch: d.default_branch,
    url: d.html_url,
    private: d.private,
  };
}

interface TreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

/** Recursively fetch the repo tree for a branch. */
export async function getTree(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<TreeItem[]> {
  // Get branch SHA
  const br = await fetch(`${API}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  });
  if (!br.ok) throw new Error(`Branch "${branch}" not found (${br.status}).`);
  const brData = (await br.json()) as { commit: { sha: string } };
  const sha = brData.commit.sha;

  const r = await fetch(
    `${API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    { headers: authHeaders(token) }
  );
  if (!r.ok) throw new Error(`Tree fetch failed: ${r.status}`);
  const data = (await r.json()) as { tree: TreeItem[]; truncated: boolean };
  if (data.truncated) throw new Error('Repository tree is too large (truncated). Try a smaller repo.');
  return data.tree.filter((t) => t.type === 'blob');
}

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|txt|html|css|scss|sass|less|py|go|rs|java|kt|c|cpp|h|hpp|cs|rb|php|vue|svelte|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|sql|graphql|gql|env|gitignore|dockerfile|makefile)$/i;
const SKIP_DIRS = /^(node_modules|\.git|dist|build|\.next|coverage|\.cache|\.turbo|out)\//;
const MAX_FILE_BYTES = 180_000;

function isLikelyText(path: string): boolean {
  if (/\.(png|jpe?g|gif|webp|ico|svg|woff2?|eot|ttf|otf|mp[34]|wav|ogg|zip|tar|gz|rar|pdf|exe|dll|so|dylib|wasm|lock)$/i.test(path)) return false;
  if (TEXT_EXT.test(path)) return true;
  const base = path.split('/').pop() || '';
  if (/^(readme|license|dockerfile|makefile|\.env)/i.test(base)) return true;
  return false;
}

export interface CloneResult {
  files: VFile[];
  repo: RepoInfo;
}

export async function cloneRepo(
  token: string,
  repoInput: string,
  branch?: string
): Promise<CloneResult> {
  const parsed = parseRepoUrl(repoInput);
  if (!parsed) throw new Error('Could not parse repo URL. Use owner/repo or a github.com URL.');
  const { owner, repo } = parsed;

  const meta = await getRepoMeta(token, owner, repo);
  const targetBranch = branch || meta.branch;

  const tree = await getTree(token, owner, repo, targetBranch);
  const files: VFile[] = [];

  // Fetch file contents in batches to avoid hammering the API
  const blobs = tree.filter((t) => !SKIP_DIRS.test(t.path) && isLikelyText(t.path) && (t.size ?? 0) <= MAX_FILE_BYTES);

  const BATCH = 12;
  for (let i = 0; i < blobs.length; i += BATCH) {
    const slice = blobs.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (item) => {
        try {
          const r = await fetch(
            `${API}/repos/${owner}/${repo}/contents/${item.path}?ref=${encodeURIComponent(targetBranch)}`,
            { headers: authHeaders(token) }
          );
          if (!r.ok) return null;
          const d = (await r.json()) as { content?: string; encoding?: string };
          if (d.encoding === 'base64' && d.content) {
            const content = atob(d.content.replace(/\n/g, ''));
            return { path: item.path, content } as VFile;
          }
          return null;
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r) files.push({ ...r, originalContent: r.content, status: 'unchanged' });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    files,
    repo: { ...meta, branch: targetBranch },
  };
}

/** Stage changed files into a new Git tree (without committing yet). Returns the new tree SHA. */
export async function stageChanges(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: VFile[]
): Promise<string> {
  const H = authHeaders(token);

  // 1. Get branch ref SHA
  const refR = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { headers: H });
  if (!refR.ok) throw new Error(`Could not find branch "${branch}" (${refR.status}).`);
  const ref = (await refR.json()) as { object: { sha: string } };
  const baseSha = ref.object.sha;

  // 2. Get base commit + tree
  const commitR = await fetch(`${API}/repos/${owner}/${repo}/git/commits/${baseSha}`, { headers: H });
  if (!commitR.ok) throw new Error('Could not fetch base commit.');
  const commit = (await commitR.json()) as { tree: { sha: string } };
  const baseTreeSha = commit.tree.sha;

  // 3. Build new tree items (only changed files)
  const treeItems: { path: string; mode: string; type: 'blob'; content?: string; sha?: string | null }[] = [];
  for (const f of files) {
    if (f.status === 'unchanged') continue;
    if (f.status === 'deleted') {
      treeItems.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
    } else {
      treeItems.push({ path: f.path, mode: '100644', type: 'blob', content: f.content });
    }
  }
  if (treeItems.length === 0) throw new Error('No changes to commit.');

  // 4. Create new tree
  const newTreeR = await fetch(`${API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });
  if (!newTreeR.ok) throw new Error(`Stage failed: ${newTreeR.status}`);
  const newTree = (await newTreeR.json()) as { sha: string };
  return newTree.sha;
}

/** Push a set of changes back to GitHub. Returns the new commit SHA. */
export async function pushChanges(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: VFile[],
  message: string
): Promise<string> {
  const H = authHeaders(token);
  const treeSha = await stageChanges(token, owner, repo, branch, files);

  // Get the current branch ref SHA for the parent
  const refR = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { headers: H });
  if (!refR.ok) throw new Error(`Could not find branch "${branch}" (${refR.status}).`);
  const ref = (await refR.json()) as { object: { sha: string } };
  const baseSha = ref.object.sha;

  // Create commit
  const newCommitR = await fetch(`${API}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ message, tree: treeSha, parents: [baseSha] }),
  });
  if (!newCommitR.ok) throw new Error(`Create commit failed: ${newCommitR.status}`);
  const newCommit = (await newCommitR.json()) as { sha: string };

  // Update ref (push)
  const updateRefR = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });
  if (!updateRefR.ok) {
    const t = await updateRefR.text().catch(() => '');
    throw new Error(`Push failed (ref update): ${updateRefR.status}. ${t.slice(0, 200)}`);
  }
  return newCommit.sha;
}

export async function verifyToken(token: string): Promise<{ login: string } | null> {
  try {
    const r = await fetch(`${API}/user`, { headers: authHeaders(token) });
    if (!r.ok) return null;
    const d = (await r.json()) as { login: string };
    return { login: d.login };
  } catch {
    return null;
  }
}

/** List commit history for a branch (paginated). */
export async function listCommits(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  page = 1,
  perPage = 30
): Promise<CommitInfo[]> {
  const r = await fetch(
    `${API}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}&page=${page}`,
    { headers: authHeaders(token) }
  );
  if (!r.ok) throw new Error(`List commits failed: ${r.status}`);
  const data = (await r.json()) as Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
    html_url: string;
    author?: { login: string } | null;
  }>;
  return data.map((c) => ({
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    message: c.commit.message,
    subject: c.commit.message.split('\n')[0],
    author: c.author?.login || c.commit.author.name,
    date: c.commit.author.date,
    url: c.html_url,
  }));
}

/** Get the full file tree at a specific commit SHA. */
async function getTreeAtSha(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<TreeItem[]> {
  const r = await fetch(
    `${API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    { headers: authHeaders(token) }
  );
  if (!r.ok) throw new Error(`Tree fetch failed: ${r.status}`);
  const data = (await r.json()) as { tree: TreeItem[]; truncated: boolean };
  if (data.truncated) throw new Error('Repository tree is too large (truncated). Try a smaller repo.');
  return data.tree.filter((t) => t.type === 'blob');
}

/** Fetch file contents at a specific commit SHA. */
async function fetchFileAtRef(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const r = await fetch(
      `${API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
      { headers: authHeaders(token) }
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { content?: string; encoding?: string };
    if (d.encoding === 'base64' && d.content) {
      return atob(d.content.replace(/\n/g, ''));
    }
    return null;
  } catch {
    return null;
  }
}

/** Restore the VFS to the exact state of a given commit SHA.
 *  Loads all text files as they were at that commit. Returns VFile[] and a RestoreSummary. */
export interface RestoreResult {
  files: VFile[];
  commit: CommitInfo;
}

export async function restoreAtCommit(
  token: string,
  owner: string,
  repo: string,
  commit: CommitInfo
): Promise<RestoreResult> {
  const tree = await getTreeAtSha(token, owner, repo, commit.sha);
  const files: VFile[] = [];

  const blobs = tree.filter(
    (t) => !SKIP_DIRS.test(t.path) && isLikelyText(t.path) && (t.size ?? 0) <= MAX_FILE_BYTES
  );

  const BATCH = 12;
  for (let i = 0; i < blobs.length; i += BATCH) {
    const slice = blobs.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (item) => {
        const content = await fetchFileAtRef(token, owner, repo, item.path, commit.sha);
        if (content === null) return null;
        return { path: item.path, content } as VFile;
      })
    );
    for (const r of results) {
      if (r) files.push({ ...r, originalContent: r.content, status: 'unchanged' });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, commit };
}
