import { useEffect, useState } from 'react';

type LogEntry = {
  ts: number;
  level: 'info' | 'warn' | 'error';
  module: string;
  message: string;
  extra?: unknown;
};

type Filter = 'all' | 'info' | 'warn' | 'error';

const LEVEL_STYLE: Record<string, React.CSSProperties> = {
  info: { color: '#1a6f3c' },
  warn: { color: '#b76e00' },
  error: { color: '#c00' },
};

export function LogsPage({ token }: { token: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    fetch('/api/logs', { headers: { 'X-Session-Token': token } })
      .then(r => r.json())
      .then(setLogs)
      .catch(() => setError('Failed to load logs.'))
      .finally(() => setLoading(false));
  }, [token]);

  const FILTERS: Filter[] = ['all', 'info', 'warn', 'error'];

  const visible = filter === 'all' ? logs : logs.filter(l => l.level === filter);
  const sorted = [...visible].sort((a, b) => b.ts - a.ts);

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: '#c00' }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.3rem 0.75rem',
              border: '1px solid',
              borderColor: filter === f ? '#ff4500' : '#ccc',
              borderRadius: 4,
              background: filter === f ? '#ff4500' : '#fff',
              color: filter === f ? '#fff' : '#444',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: '0.8rem', alignSelf: 'center' }}>
          {sorted.length} entries
        </span>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.875rem' }}>No log entries.</p>
      ) : (
        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {sorted.map((entry, i) => (
            <div
              key={i}
              style={{ display: 'grid', gridTemplateColumns: '10rem 3.5rem 7rem 1fr', gap: '0 0.75rem', padding: '0.3rem 0', borderBottom: '1px solid #f0f0f0' }}
            >
              <span style={{ color: '#888' }}>{new Date(entry.ts).toLocaleString()}</span>
              <span style={{ ...LEVEL_STYLE[entry.level], fontWeight: 700, textTransform: 'uppercase' }}>{entry.level}</span>
              <span style={{ color: '#555' }}>[{entry.module}]</span>
              <span>
                {entry.message}
                {entry.extra !== undefined && (
                  <span style={{ color: '#888', marginLeft: '0.4rem' }}>{JSON.stringify(entry.extra)}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
