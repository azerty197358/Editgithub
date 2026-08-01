/**
 * Vercel Serverless Function: Raw SQL execution for Supabase
 * Runs the exact schema introspection query when PostgREST/RPC fails.
 * Uses the service role key to bypass RLS for schema reads only.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sql, url, anonKey } = req.body || {};

    const supabaseUrl = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = anonKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({ error: 'Missing Supabase URL or key' });
    }

    // If no custom SQL provided, run the default schema introspection query
    const query = sql || `SELECT t.table_name AS "table_name", c.column_name AS "column_name", c.data_type AS "data_type", c.is_nullable AS "is_nullable"
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position`;

    // Use Supabase's REST API with the service role key to run raw SQL via the pg meta endpoint
    const metaUrl = `${supabaseUrl}/rest/v1/rpc/get_schema_introspection`;

    // First try the RPC function
    const rpcResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    });

    if (rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ data: rpcData, source: 'rpc' });
      }
    }

    // Fallback: query information_schema.columns directly via PostgREST
    const columnsUrl = `${supabaseUrl}/rest/v1/information_schema.columns?select=table_name,column_name,data_type,is_nullable&table_schema=eq.public&order=table_name.asc,ordinal_position.asc`;
    const columnsResponse = await fetch(columnsUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (columnsResponse.ok) {
      const columnsData = await columnsResponse.json();
      if (columnsData && Array.isArray(columnsData) && columnsData.length > 0) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ data: columnsData, source: 'postgrest-columns' });
      }
    }

    // Fallback 2: query information_schema.tables for at least table names
    const tablesUrl = `${supabaseUrl}/rest/v1/information_schema.tables?select=table_name,table_type&table_schema=eq.public`;
    const tablesResponse = await fetch(tablesUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (tablesResponse.ok) {
      const tablesData = await tablesResponse.json();
      if (tablesData && Array.isArray(tablesData) && tablesData.length > 0) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ data: tablesData, source: 'postgrest-tables' });
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(404).json({ error: 'No tables found. The database may be empty or credentials may lack access.', data: [] });
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
}
