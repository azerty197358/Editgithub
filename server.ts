import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// API route for Supabase fetch-schema / raw SQL query proxy
app.post('/api/fetch-schema', async (req, res) => {
  try {
    const { url, anonKey } = req.body || {};

    const supabaseUrl = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = anonKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({ error: 'Missing Supabase URL or key' });
    }

    // Try RPC function
    const metaUrl = `${supabaseUrl}/rest/v1/rpc/get_schema_introspection`;
    const rpcResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    }).catch(() => null);

    if (rpcResponse && rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        return res.status(200).json({ data: rpcData, source: 'rpc' });
      }
    }

    // Fallback: PostgREST columns
    const columnsUrl = `${supabaseUrl}/rest/v1/information_schema.columns?select=table_name,column_name,data_type,is_nullable&table_schema=eq.public&order=table_name.asc,ordinal_position.asc`;
    const columnsResponse = await fetch(columnsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }).catch(() => null);

    if (columnsResponse && columnsResponse.ok) {
      const columnsData = await columnsResponse.json();
      if (columnsData && Array.isArray(columnsData) && columnsData.length > 0) {
        return res.status(200).json({ data: columnsData, source: 'postgrest-columns' });
      }
    }

    // Fallback: PostgREST tables
    const tablesUrl = `${supabaseUrl}/rest/v1/information_schema.tables?select=table_name,table_type&table_schema=eq.public`;
    const tablesResponse = await fetch(tablesUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }).catch(() => null);

    if (tablesResponse && tablesResponse.ok) {
      const tablesData = await tablesResponse.json();
      if (tablesData && Array.isArray(tablesData) && tablesData.length > 0) {
        return res.status(200).json({ data: tablesData, source: 'postgrest-tables' });
      }
    }

    return res.status(404).json({ error: 'No tables found. The database may be empty or credentials may lack access.', data: [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return res.status(500).json({ error: message });
  }
});

// Proxy route for Gemini API if server key is present
app.post('/api/gemini/stream', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || req.body?.apiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API key is required.' });
    }
    const model = req.body?.model || 'gemini-2.5-flash';
    const body = req.body?.body;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    if (response.body) {
      // @ts-expect-error fetch Body stream in Node runtime
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return res.status(500).json({ error: message });
  }
});

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenCode server running on http://0.0.0.0:${PORT}`);
  });
}

main();
