import { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, RefreshCw, Plus, Trash2, Save, X, AlertCircle, Table2, ChevronRight, Check, Eye, HardDrive, Terminal, Send } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { getSupabase, hasCredentials, fetchSchema, probeTable, executeRawSQL, type TableColumn } from '@/lib/supabase';

interface Props {
  onNeedSettings: () => void;
}

interface RowData {
  [key: string]: unknown;
}

type Category = 'tables' | 'views' | 'storage';

export function DatabasePanel({ onNeedSettings }: Props) {
  const { settings } = useSettings();
  const [category, setCategory] = useState<Category>('tables');
  const [tables, setTables] = useState<string[]>([]);
  const [views, setViews] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowPk: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pkColumn, setPkColumn] = useState<string>('id');
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<RowData>({});
  const [saving, setSaving] = useState(false);
  const [manualTable, setManualTable] = useState('');
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [sqlInput, setSqlInput] = useState('');
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlResultMsg, setSqlResultMsg] = useState<string | null>(null);

  const credsReady = hasCredentials(settings.supabaseUrl, settings.supabaseAnonKey);

  const loadTree = useCallback(async () => {
    if (!credsReady) return;
    setLoadingTree(true);
    setErr(null);
    try {
      const snap = await fetchSchema(settings.supabaseUrl, settings.supabaseAnonKey);
      setTables(snap.tables.map((t) => t.name).sort());
      setViews(snap.views.sort());
      setBuckets(snap.buckets.sort());
    } catch (e: unknown) {
      const err = e as { message?: string };
      setErr(err.message || JSON.stringify(e));
      setTables([]);
      setViews([]);
      setBuckets([]);
    } finally {
      setLoadingTree(false);
    }
  }, [credsReady, settings.supabaseUrl, settings.supabaseAnonKey]);

  useEffect(() => { if (credsReady) loadTree(); }, [credsReady, loadTree]);

  async function addManualTable() {
    const name = manualTable.trim();
    if (!name) return;
    setErr(null);
    const cols = await probeTable(settings.supabaseUrl, settings.supabaseAnonKey, name);
    if (cols === null) {
      setErr(`Table "${name}" not found or not accessible. Check the name and try again.`);
      return;
    }
    setTables((prev) => prev.includes(name) ? prev : [...prev, name].sort());
    setManualTable('');
    setOkMsg(`Table "${name}" added`); setTimeout(() => setOkMsg(null), 2000);
  }

  async function loadTable(name: string) {
    const client = getSupabase(settings.supabaseUrl, settings.supabaseAnonKey);
    if (!client) return;
    setSelectedTable(name);
    setErr(null);
    setRows([]);
    setColumns([]);
    setLoading(true);
    setEditingCell(null);
    setAddingRow(false);
    try {
      // Try information_schema for column metadata
      let cols: TableColumn[] = [];
      try {
        const { data: colData, error: colErr } = await client
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_name', name)
          .order('ordinal_position');
        if (!colErr && colData) {
          cols = (colData as {
            column_name: string; data_type: string; is_nullable: string; column_default: string | null;
          }[]).map((c) => ({
            name: c.column_name, format: c.data_type,
            isPrimaryKey: c.column_name === 'id',
            isNullable: c.is_nullable === 'YES',
            defaultValue: c.column_default,
          }));
        }
      } catch { /* fall through */ }

      // Fallback: infer columns from a sample row
      if (cols.length === 0) {
        const { data: sample } = await client.from(name).select('*').limit(1);
        if (sample && sample.length > 0) {
          cols = Object.keys(sample[0]).map((k) => ({
            name: k, format: typeof sample[0][k] === 'number' ? 'int' : 'text',
            isPrimaryKey: k === 'id', isNullable: k !== 'id', defaultValue: null,
          }));
        }
      }
      setColumns(cols);
      const pk = cols.find((c) => c.isPrimaryKey)?.name || 'id';
      setPkColumn(pk);
      const { data: rowData, error: rowErr } = await client.from(name).select('*').order(pk, { ascending: false }).limit(100);
      if (rowErr) throw rowErr;
      setRows(rowData || []);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setErr(err.message || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  }

  async function saveCell(rowPk: string, col: string, value: string) {
    const client = getSupabase(settings.supabaseUrl, settings.supabaseAnonKey);
    if (!client || !selectedTable) return;
    setSaving(true); setErr(null);
    try {
      const fmt = columns.find((c) => c.name === col)?.format;
      const parsed = parseValue(value, fmt);
      const { error } = await client.from(selectedTable).update({ [col]: parsed }).eq(pkColumn, rowPk);
      if (error) throw error;
      setRows((prev) => prev.map((r) => r[pkColumn] === rowPk ? { ...r, [col]: parsed } : r));
      setEditingCell(null);
      setOkMsg('Saved'); setTimeout(() => setOkMsg(null), 1500);
    } catch (e: unknown) { const err = e as { message?: string }; setErr(err.message || JSON.stringify(e)); }
    finally { setSaving(false); }
  }

  async function deleteRow(rowPk: string) {
    const client = getSupabase(settings.supabaseUrl, settings.supabaseAnonKey);
    if (!client || !selectedTable) return;
    if (!confirm('Delete this row?')) return;
    setSaving(true); setErr(null);
    try {
      const { error } = await client.from(selectedTable).delete().eq(pkColumn, rowPk);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r[pkColumn] !== rowPk));
      setOkMsg('Row deleted'); setTimeout(() => setOkMsg(null), 1500);
    } catch (e: unknown) { const err = e as { message?: string }; setErr(err.message || JSON.stringify(e)); }
    finally { setSaving(false); }
  }

  async function insertRow() {
    const client = getSupabase(settings.supabaseUrl, settings.supabaseAnonKey);
    if (!client || !selectedTable) return;
    setSaving(true); setErr(null);
    try {
      const insertData: RowData = {};
      for (const c of columns) {
        if (c.isPrimaryKey && c.format === 'uuid') continue;
        if (c.name === 'created_at') continue;
        if (newRow[c.name] !== undefined && newRow[c.name] !== '') {
          insertData[c.name] = parseValue(String(newRow[c.name]), c.format);
        }
      }
      const { data, error } = await client.from(selectedTable).insert(insertData).select('*').single();
      if (error) throw error;
      setRows((prev) => [data as RowData, ...prev]);
      setAddingRow(false); setNewRow({});
      setOkMsg('Row added'); setTimeout(() => setOkMsg(null), 1500);
    } catch (e: unknown) { const err = e as { message?: string }; setErr(err.message || JSON.stringify(e)); }
    finally { setSaving(false); }
  }

  if (!credsReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Database size={28} style={{ color: 'var(--text-mute)' }} className="mb-3" />
        <p className="text-sm mb-1" style={{ color: 'var(--text-dim)' }}>Database not connected</p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-mute)' }}>Add your Supabase project URL and anon key in Settings.</p>
        <button className="btn btn-primary text-xs" onClick={onNeedSettings}>Open Settings</button>
      </div>
    );
  }

  const treeItems = category === 'tables' ? tables : category === 'views' ? views : buckets;
  const itemIcons = category === 'tables' ? <Table2 size={13} /> : category === 'views' ? <Eye size={13} /> : <HardDrive size={13} />;

  return (
    <div className="flex h-full">
      {/* Sidebar: category tabs + item list */}
      <div className="w-56 shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev)' }}>
        <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center gap-2">
            <Database size={14} style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Supabase</span>
          </div>
          <button className="btn btn-ghost !p-1" onClick={loadTree} disabled={loadingTree} title="Refresh">
            <RefreshCw size={12} className={loadingTree ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Category switcher */}
        <div className="flex border-b text-[10px]" style={{ borderColor: 'var(--border-soft)' }}>
          {(['tables', 'views', 'storage'] as Category[]).map((c) => (
            <button
              key={c}
              className="flex-1 py-2 capitalize font-medium transition-colors"
              style={{
                color: category === c ? 'var(--text)' : 'var(--text-mute)',
                borderBottom: category === c ? '2px solid var(--primary)' : '2px solid transparent',
              }}
              onClick={() => setCategory(c)}
            >
              {c}
              <span className="ml-1 opacity-60">{c === 'tables' ? tables.length : c === 'views' ? views.length : buckets.length}</span>
            </button>
          ))}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {loadingTree ? (
            <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-mute)' }} /></div>
          ) : treeItems.length === 0 ? (
            <div className="px-3 py-3">
              <div className="text-center text-xs mb-3" style={{ color: 'var(--text-mute)' }}>
                No {category} found.
                {category === 'tables' && ' You can add a table manually below.'}
              </div>
              {category === 'tables' && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      className="input text-xs flex-1"
                      placeholder="Enter table name..."
                      value={manualTable}
                      onChange={(e) => setManualTable(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addManualTable(); }}
                    />
                    <button className="btn btn-soft text-xs !py-1.5" onClick={addManualTable} title="Add table">
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    className="btn btn-ghost text-xs w-full !py-1.5"
                    onClick={loadTree}
                  >
                    <RefreshCw size={12} /> Retry Connection
                  </button>
                  {/* Manual SQL Console */}
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'var(--text-mute)' }}>
                      <Terminal size={11} /> SQL Console
                    </div>
                    <textarea
                      className="input text-[11px] mono resize-none mb-1.5"
                      rows={5}
                      placeholder="SELECT t.table_name, c.column_name, c.data_type FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name WHERE t.table_schema = 'public';"
                      value={sqlInput}
                      onChange={(e) => setSqlInput(e.target.value)}
                    />
                    <button
                      className="btn btn-primary text-xs w-full !py-1.5 flex items-center justify-center gap-1.5"
                      onClick={async () => {
                        if (!sqlInput.trim()) return;
                        setSqlRunning(true); setSqlResultMsg(null);
                        try {
                          const { data, error } = await executeRawSQL(settings.supabaseUrl, settings.supabaseAnonKey, sqlInput.trim());
                          if (error) {
                            setSqlResultMsg(`Error: ${error}`);
                          } else if (data && data.length > 0) {
                            // Parse table_name / column_name rows to populate sidebar
                            const found = new Map<string, TableColumn[]>();
                            for (const row of data as Record<string, unknown>[]) {
                              const tn = (row.table_name || row['اسم الجدول']) as string;
                              const cn = (row.column_name || row['اسم العمود']) as string;
                              const dt = (row.data_type || row['نوع البيانات']) as string;
                              const nullable = (row.is_nullable || row['يقبل قيمة فارغة؟']) as string;
                              if (tn) {
                                if (!found.has(tn)) found.set(tn, []);
                                if (cn) found.get(tn)!.push({
                                  name: cn, format: dt || 'text',
                                  isPrimaryKey: cn === 'id',
                                  isNullable: nullable === 'YES',
                                  defaultValue: null,
                                });
                              }
                            }
                            if (found.size > 0) {
                              setTables([...found.keys()].sort());
                              setSqlResultMsg(`Found ${found.size} table(s): ${[...found.keys()].join(', ')}`);
                            } else {
                              setSqlResultMsg(`Query returned ${data.length} row(s) but no table_name columns. Raw data logged.`);
                            }
                          } else {
                            setSqlResultMsg('Query returned 0 rows.');
                          }
                        } catch (e: unknown) {
                          const err = e as { message?: string };
                          setSqlResultMsg(`Error: ${err.message || String(e)}`);
                        } finally {
                          setSqlRunning(false);
                        }
                      }}
                      disabled={sqlRunning || !sqlInput.trim()}
                    >
                      {sqlRunning ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      Run SQL
                    </button>
                    {sqlResultMsg && (
                      <p className="text-[10px] mt-1.5" style={{ color: sqlResultMsg.startsWith('Error') ? 'var(--error)' : 'var(--success)' }}>
                        {sqlResultMsg}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {treeItems.map((t) => (
                <button
                  key={t}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                  style={{ background: selectedTable === t && category === 'tables' ? 'var(--primary-dim)' : 'transparent', color: selectedTable === t && category === 'tables' ? 'var(--text)' : 'var(--text-dim)' }}
                  onClick={() => category === 'tables' ? loadTable(t) : setSelectedTable(t)}
                >
                  {itemIcons}
                  <span className="truncate mono">{t}</span>
                </button>
              ))}
              {category === 'tables' && (
                <div className="px-2 pt-2 pb-3 border-t mt-1" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex gap-1.5">
                    <input
                      className="input text-xs flex-1"
                      placeholder="Add table name..."
                      value={manualTable}
                      onChange={(e) => setManualTable(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addManualTable(); }}
                    />
                    <button className="btn btn-soft text-xs !py-1.5" onClick={addManualTable} title="Add table manually">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {err && (
          <div className="px-3 py-2 flex items-start gap-1.5 text-xs" style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.06)' }}>
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {err}
          </div>
        )}
        {okMsg && (
          <div className="px-3 py-1.5 flex items-center gap-1.5 text-xs fade-in" style={{ color: 'var(--success)', background: 'rgba(34,197,94,0.06)' }}>
            <Check size={13} /> {okMsg}
          </div>
        )}

        {category === 'storage' ? (
          <StorageView buckets={buckets} url={settings.supabaseUrl} anonKey={settings.supabaseAnonKey} />
        ) : category === 'views' ? (
          <ViewDataView selectedView={selectedTable} url={settings.supabaseUrl} anonKey={settings.supabaseAnonKey} />
        ) : !selectedTable ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Database size={28} style={{ color: 'var(--text-mute)' }} className="mb-3" />
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Select a table to view its data</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-mute)' }} /></div>
        ) : (
          <>
            <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="flex items-center gap-2">
                <ChevronRight size={13} style={{ color: 'var(--text-mute)' }} />
                <span className="text-xs font-semibold mono" style={{ color: 'var(--text)' }}>{selectedTable}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-mute)' }}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
              </div>
              <button className="btn btn-soft text-xs !py-1" onClick={() => { setAddingRow(!addingRow); setNewRow({}); }} disabled={saving}>
                <Plus size={13} /> Add row
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {rows.length === 0 && !addingRow ? (
                <div className="flex items-center justify-center h-full p-8 text-center">
                  <p className="text-xs" style={{ color: 'var(--text-mute)' }}>This table is empty. Click "Add row" to insert data.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: 'var(--bg-elev)' }}>
                      <th className="px-2 py-2 text-left text-[10px] uppercase font-semibold w-8" style={{ color: 'var(--text-mute)' }}></th>
                      {columns.map((c) => (
                        <th key={c.name} className="px-3 py-2 text-left text-[10px] uppercase font-semibold whitespace-nowrap" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>
                          {c.name}
                          {c.isPrimaryKey && <span className="ml-1 text-[8px] px-1 rounded" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>PK</span>}
                          <span className="ml-1 text-[8px] normal-case" style={{ color: 'var(--text-mute)' }}>{c.format}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {addingRow && (
                      <tr style={{ background: 'rgba(59,130,246,0.06)' }}>
                        <td className="px-2 py-1.5"></td>
                        {columns.map((c) => (
                          <td key={c.name} className="px-1 py-1">
                            {c.isPrimaryKey && c.format === 'uuid' ? (
                              <span className="text-[10px] px-2" style={{ color: 'var(--text-mute)' }}>auto</span>
                            ) : c.name === 'created_at' ? (
                              <span className="text-[10px] px-2" style={{ color: 'var(--text-mute)' }}>auto</span>
                            ) : (
                              <input
                                className="input !py-1 !px-2 text-xs"
                                placeholder={c.name}
                                value={(newRow[c.name] as string) ?? ''}
                                onChange={(e) => setNewRow((p) => ({ ...p, [c.name]: e.target.value }))}
                                type={c.format.includes('int') ? 'number' : 'text'}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                    {rows.map((row, ri) => (
                      <tr key={(row[pkColumn] as string) ?? ri} className="hover:bg-[var(--bg-elev-2)] transition-colors group">
                        <td className="px-2 py-1.5">
                          <button className="btn btn-ghost !p-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteRow(row[pkColumn] as string)} title="Delete row">
                            <Trash2 size={12} style={{ color: 'var(--error)' }} />
                          </button>
                        </td>
                        {columns.map((c) => {
                          const isEditing = editingCell?.rowPk === row[pkColumn] && editingCell?.col === c.name;
                          const val = row[c.name];
                          return (
                            <td key={c.name} className="px-3 py-1.5 cursor-text" style={{ borderBottom: '1px solid var(--border-soft)' }}
                              onClick={() => { if (!c.isPrimaryKey) { setEditingCell({ rowPk: row[pkColumn] as string, col: c.name }); setEditValue(formatCell(val)); } }}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input autoFocus className="input !py-0.5 !px-1.5 text-xs mono" value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveCell(row[pkColumn] as string, c.name, editValue); if (e.key === 'Escape') setEditingCell(null); }}
                                  />
                                  <button className="btn btn-primary !p-1" onClick={() => saveCell(row[pkColumn] as string, c.name, editValue)} disabled={saving}><Save size={11} /></button>
                                  <button className="btn btn-ghost !p-1" onClick={() => setEditingCell(null)}><X size={11} /></button>
                                </div>
                              ) : (
                                <span className="mono truncate block max-w-[280px]" style={{ color: val === null ? 'var(--text-mute)' : 'var(--text-dim)', fontStyle: val === null ? 'italic' : 'normal' }}>
                                  {val === null ? 'null' : formatCell(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {addingRow && (
              <div className="px-3 py-2 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev-2)' }}>
                <button className="btn btn-ghost text-xs" onClick={() => { setAddingRow(false); setNewRow({}); }}><X size={13} /> Cancel</button>
                <button className="btn btn-primary text-xs" onClick={insertRow} disabled={saving}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Insert row
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Storage bucket browser — lists files in a selected bucket. */
function StorageView({ buckets, url, anonKey }: { buckets: string[]; url: string; anonKey: string }) {
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [files, setFiles] = useState<{ name: string; size: number; id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function listFiles(bucket: string) {
    const client = getSupabase(url, anonKey);
    if (!client) return;
    setSelectedBucket(bucket);
    setLoading(true); setErr(null);
    try {
      const { data, error } = await client.storage.from(bucket).list();
      if (error) throw error;
      setFiles((data || []).map((f) => ({ name: f.name, size: f.metadata?.size ?? 0, id: f.id })));
    } catch (e: unknown) { const err = e as { message?: string }; setErr(err.message || JSON.stringify(e)); setFiles([]); }
    finally { setLoading(false); }
  }

  if (buckets.length === 0) {
    return <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><HardDrive size={28} style={{ color: 'var(--text-mute)' }} className="mb-3" /><p className="text-xs" style={{ color: 'var(--text-mute)' }}>No storage buckets found.</p></div>;
  }

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-44 shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elev)' }}>
        {buckets.map((b) => (
          <button key={b} className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
            style={{ background: selectedBucket === b ? 'var(--primary-dim)' : 'transparent', color: selectedBucket === b ? 'var(--text)' : 'var(--text-dim)' }}
            onClick={() => listFiles(b)}>
            <HardDrive size={13} /> <span className="truncate mono">{b}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {err && <div className="px-3 py-2 text-xs" style={{ color: 'var(--error)' }}><AlertCircle size={13} className="inline mr-1" />{err}</div>}
        {!selectedBucket ? (
          <div className="flex-1 flex items-center justify-center h-full p-8"><p className="text-xs" style={{ color: 'var(--text-mute)' }}>Select a bucket to browse its files.</p></div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-mute)' }} /></div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8"><p className="text-xs" style={{ color: 'var(--text-mute)' }}>This bucket is empty.</p></div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0"><tr style={{ background: 'var(--bg-elev)' }}>
              <th className="px-3 py-2 text-left text-[10px] uppercase font-semibold" style={{ color: 'var(--text-dim)' }}>File</th>
              <th className="px-3 py-2 text-left text-[10px] uppercase font-semibold" style={{ color: 'var(--text-dim)' }}>Size</th>
            </tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="hover:bg-[var(--bg-elev-2)]">
                  <td className="px-3 py-1.5 mono truncate" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)' }}>{f.name}</td>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-mute)', borderBottom: '1px solid var(--border-soft)' }}>{f.size > 0 ? formatBytes(f.size) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Read-only data viewer for views. */
function ViewDataView({ selectedView, url, anonKey }: { selectedView: string | null; url: string; anonKey: string }) {
  const [rows, setRows] = useState<RowData[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedView) return;
    const client = getSupabase(url, anonKey);
    if (!client) return;
    setLoading(true); setErr(null);
    (async () => {
      try {
        const { data, error } = await client.from(selectedView).select('*').limit(50);
        if (error) { setErr(error.message); setRows([]); setCols([]); }
        else {
          setRows(data || []);
          setCols(data && data.length > 0 ? Object.keys(data[0]) : []);
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        setErr(err.message || JSON.stringify(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedView, url, anonKey]);

  if (!selectedView) {
    return <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><Eye size={28} style={{ color: 'var(--text-mute)' }} className="mb-3" /><p className="text-sm" style={{ color: 'var(--text-dim)' }}>Select a view to preview its data</p></div>;
  }
  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-mute)' }} /></div>;
  if (err) return <div className="px-3 py-2 text-xs" style={{ color: 'var(--error)' }}><AlertCircle size={13} className="inline mr-1" />{err}</div>;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-soft)' }}>
        <Eye size={13} style={{ color: 'var(--primary)' }} />
        <span className="text-xs font-semibold mono" style={{ color: 'var(--text)' }}>{selectedView}</span>
        <span className="text-[10px]" style={{ color: 'var(--text-mute)' }}>read-only · {rows.length} rows</span>
      </div>
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8"><p className="text-xs" style={{ color: 'var(--text-mute)' }}>This view has no rows.</p></div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0"><tr style={{ background: 'var(--bg-elev)' }}>
              {cols.map((c) => <th key={c} className="px-3 py-2 text-left text-[10px] uppercase font-semibold whitespace-nowrap" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>{c}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-[var(--bg-elev-2)]">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-1.5 mono truncate max-w-[280px]" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-soft)' }}>{formatCell(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return `[${val.length} items]`;
    return JSON.stringify(val);
  }
  if (typeof val === 'string' && val.length > 8 && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    try {
      return new Date(val).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { /* ignore */ }
  }
  return String(val);
}

function parseValue(raw: string, format?: string): unknown {
  if (raw === '' || raw === 'null') return null;
  if (format?.includes('int') || format?.includes('numeric') || format?.includes('float') || format?.includes('double')) {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  if (format === 'boolean') return raw === 'true' || raw === 't' || raw === '1';
  return raw;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
