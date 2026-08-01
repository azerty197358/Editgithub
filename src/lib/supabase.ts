import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface TableColumn {
  name: string;
  format: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  defaultValue: string | null;
}

export interface TableSchema {
  table: string;
  columns: TableColumn[];
}

export interface SchemaSnapshot {
  tables: { name: string; columns: TableColumn[] }[];
  views: string[];
  buckets: string[];
}

const ENV_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let _client: SupabaseClient | null = null;
let _clientUrl = '';
let _clientKey = '';

/** Returns a Supabase client built from the user's settings, or the env defaults. */
export function getSupabase(url?: string, anonKey?: string): SupabaseClient | null {
  const u = url || ENV_URL;
  const k = anonKey || ENV_KEY;
  if (!u || !k) return null;
  if (_client && _clientUrl === u && _clientKey === k) return _client;
  _client = createClient(u, k);
  _clientUrl = u;
  _clientKey = k;
  return _client;
}

/** Quick check whether credentials are present (does not validate them). */
export function hasCredentials(url?: string, key?: string): boolean {
  return !!(url || ENV_URL) && !!(key || ENV_KEY);
}

/** Fetch all tables, views, and storage buckets in one snapshot.
 *  Uses the get_schema_introspection() RPC function which runs the exact SQL:
 *  SELECT t.table_name, c.column_name, c.data_type, c.is_nullable
 *  FROM information_schema.tables t JOIN information_schema.columns c
 *  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
 *  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
 *  ORDER BY t.table_name, c.ordinal_position
 *  Falls back to direct PostgREST queries on information_schema if RPC is unavailable. */
export async function fetchSchema(url: string, anonKey: string): Promise<SchemaSnapshot> {
  const client = getSupabase(url, anonKey);
  if (!client) throw new Error('Supabase credentials not configured.');

  // Storage buckets
  let bucketNames: string[] = [];
  try {
    const bucketsRes = await client.storage.listBuckets();
    bucketNames = (bucketsRes.data || []).map((b: { name: string }) => b.name);
  } catch {
    // storage may not be configured
  }

  // Strategy 1: Call the get_schema_introspection() RPC function
  try {
    const { data: rpcData, error: rpcErr } = await client.rpc('get_schema_introspection');
    if (!rpcErr && rpcData) {
      const rows = rpcData as {
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
      }[];
      const grouped = new Map<string, TableColumn[]>();
      for (const r of rows) {
        if (!grouped.has(r.table_name)) grouped.set(r.table_name, []);
        grouped.get(r.table_name)!.push({
          name: r.column_name,
          format: r.data_type,
          isPrimaryKey: r.column_name === 'id',
          isNullable: r.is_nullable === 'YES',
          defaultValue: null,
        });
      }
      const tables: { name: string; columns: TableColumn[] }[] = [];
      for (const [name, cols] of grouped) {
        tables.push({ name, columns: cols });
      }
      tables.sort((a, b) => a.name.localeCompare(b.name));
      if (tables.length > 0) {
        return { tables, views: [], buckets: bucketNames };
      }
    }
  } catch {
    // RPC not available — fall through
  }

  // Strategy 2: Direct PostgREST query on information_schema.columns filtered to public
  try {
    const { data, error } = await client
      .from('information_schema.columns')
      .select('table_name, column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .order('table_name', { ascending: true })
      .order('ordinal_position', { ascending: true });

    if (!error && data) {
      const colRows = data as {
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }[];
      const grouped = new Map<string, TableColumn[]>();
      for (const r of colRows) {
        if (!grouped.has(r.table_name)) grouped.set(r.table_name, []);
        grouped.get(r.table_name)!.push({
          name: r.column_name,
          format: r.data_type,
          isPrimaryKey: r.column_name === 'id',
          isNullable: r.is_nullable === 'YES',
          defaultValue: r.column_default,
        });
      }
      const tables: { name: string; columns: TableColumn[] }[] = [];
      for (const [name, cols] of grouped) {
        tables.push({ name, columns: cols });
      }
      tables.sort((a, b) => a.name.localeCompare(b.name));
      if (tables.length > 0) {
        return { tables, views: [], buckets: bucketNames };
      }
    }
  } catch {
    // fall through
  }

  // Strategy 3: Try information_schema.tables to get at least table names
  let viewNames: string[] = [];
  try {
    const { data: tblData, error: tblErr } = await client
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public');

    if (!tblErr && tblData) {
      const rows = tblData as { table_name: string; table_type: string }[];
      const tableNames = rows.filter((r) => r.table_type === 'BASE TABLE').map((r) => r.table_name).sort();
      viewNames = rows.filter((r) => r.table_type === 'VIEW').map((r) => r.table_name).sort();
      const tables = tableNames.map((name) => ({ name, columns: [] as TableColumn[] }));
      return { tables, views: viewNames, buckets: bucketNames };
    }
  } catch {
    // fall through
  }

  // Strategy 4: Call the Vercel serverless function at /api/fetch-schema
  try {
    const resp = await fetch('/api/fetch-schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, anonKey }),
    });
    if (resp.ok) {
      const result = await resp.json() as { data: { table_name: string; column_name: string; data_type: string; is_nullable: string }[]; source: string };
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const grouped = new Map<string, TableColumn[]>();
        for (const r of result.data) {
          if (r.table_name && r.column_name) {
            if (!grouped.has(r.table_name)) grouped.set(r.table_name, []);
            grouped.get(r.table_name)!.push({
              name: r.column_name,
              format: r.data_type || 'text',
              isPrimaryKey: r.column_name === 'id',
              isNullable: r.is_nullable === 'YES',
              defaultValue: null,
            });
          }
        }
        const tables: { name: string; columns: TableColumn[] }[] = [];
        for (const [name, cols] of grouped) {
          tables.push({ name, columns: cols });
        }
        tables.sort((a, b) => a.name.localeCompare(b.name));
        if (tables.length > 0) {
          return { tables, views: [], buckets: bucketNames };
        }
      }
    }
  } catch {
    // serverless function not available (e.g. in dev) — fall through
  }

  return { tables: [], views: viewNames, buckets: bucketNames };
}

/** Execute a custom SQL query via the Vercel serverless function.
 *  Used by the manual SQL console in the Database panel. */
export async function executeRawSQL(url: string, anonKey: string, sql: string): Promise<{ data: Record<string, unknown>[] | null; error: string | null }> {
  try {
    const resp = await fetch('/api/fetch-schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, anonKey, sql }),
    });
    const result = await resp.json() as { data?: Record<string, unknown>[]; error?: string };
    if (!resp.ok) {
      return { data: null, error: result.error || `HTTP ${resp.status}` };
    }
    return { data: result.data || [], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Probe a single table name to check if it's accessible. Returns columns if found. */
export async function probeTable(url: string, anonKey: string, tableName: string): Promise<TableColumn[] | null> {
  const client = getSupabase(url, anonKey);
  if (!client) return null;
  try {
    // Try to read one row to get column names from the response shape
    const { data, error } = await client.from(tableName).select('*').limit(1);
    if (error) return null;
    if (data && data.length > 0) {
      return Object.keys(data[0]).map((k) => ({
        name: k,
        format: typeof (data[0] as Record<string, unknown>)[k] === 'number' ? 'integer' : 'text',
        isPrimaryKey: k === 'id',
        isNullable: k !== 'id',
        defaultValue: null,
      }));
    }
    // Table exists but is empty — return empty columns
    return [];
  } catch {
    return null;
  }
}

/** Render the schema snapshot as a compact text block for the AI system prompt. */
export function schemaToPromptText(snap: SchemaSnapshot): string {
  const lines: string[] = ['# Connected Supabase Database Schema'];

  if (snap.tables.length > 0) {
    lines.push('\n## Tables');
    for (const t of snap.tables) {
      const colStr = t.columns.length
        ? t.columns.map((c) => `${c.name} ${c.format}${c.isPrimaryKey ? ' PK' : ''}${!c.isNullable ? ' NOT NULL' : ''}`).join(', ')
        : '(columns unavailable)';
      lines.push(`- ${t.name}(${colStr})`);
    }
  }

  if (snap.views.length > 0) {
    lines.push('\n## Views');
    for (const v of snap.views) lines.push(`- ${v}`);
  }

  if (snap.buckets.length > 0) {
    lines.push('\n## Storage Buckets');
    for (const b of snap.buckets) lines.push(`- ${b}`);
  }

  if (snap.tables.length === 0 && snap.views.length === 0 && snap.buckets.length === 0) {
    lines.push('\n(No tables, views, or buckets found.)');
  }

  return lines.join('\n');
}

/** Fetch the top N rows from a table as JSON. Returns null if the table is inaccessible. */
export async function fetchTableData(
  url: string,
  anonKey: string,
  tableName: string,
  limit = 5
): Promise<Record<string, unknown>[] | null> {
  const client = getSupabase(url, anonKey);
  if (!client) return null;
  try {
    const { data, error } = await client.from(tableName).select('*').limit(limit);
    if (error) return null;
    return (data as Record<string, unknown>[]) || [];
  } catch {
    return null;
  }
}

/** Build a full database context string for the AI system prompt, including schema + sample row data. */
export async function buildDatabaseContextForAI(url: string, anonKey: string): Promise<string> {
  if (!hasCredentials(url, anonKey)) return '';
  try {
    const snap = await fetchSchema(url, anonKey);
    const lines: string[] = ['# Connected Supabase Database — Schema & Sample Data'];

    if (snap.tables.length > 0) {
      lines.push('\n## Tables & Columns');
      for (const t of snap.tables) {
        const colStr = t.columns.length
          ? t.columns.map((c) => `${c.name} ${c.format}${c.isPrimaryKey ? ' PK' : ''}${!c.isNullable ? ' NOT NULL' : ''}`).join(', ')
          : '(columns unavailable)';
        lines.push(`- ${t.name}(${colStr})`);
      }

      // Fetch sample rows for each table (up to 8 tables to keep prompt manageable)
      lines.push('\n## Sample Row Data (top 5 rows per table)');
      const tablesToSample = snap.tables.slice(0, 8);
      for (const t of tablesToSample) {
        const rows = await fetchTableData(url, anonKey, t.name, 5);
        if (rows && rows.length > 0) {
          lines.push(`\n### ${t.name} (${rows.length} sample rows)`);
          lines.push('```json');
          lines.push(JSON.stringify(rows, null, 2));
          lines.push('```');
        } else {
          lines.push(`\n### ${t.name}`);
          lines.push('(table is empty or not readable)');
        }
      }
    }

    if (snap.views.length > 0) {
      lines.push('\n## Views');
      for (const v of snap.views) lines.push(`- ${v}`);
    }

    if (snap.buckets.length > 0) {
      lines.push('\n## Storage Buckets');
      for (const b of snap.buckets) lines.push(`- ${b}`);
    }

    if (snap.tables.length === 0 && snap.views.length === 0 && snap.buckets.length === 0) {
      lines.push('\n(No tables, views, or buckets found.)');
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}
