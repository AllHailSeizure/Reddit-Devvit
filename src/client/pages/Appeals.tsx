import { useEffect, useState } from 'react';

type AppealRecord = {
  postId: string;
  authorName: string;
  postTitle: string;
  postUrl: string;
  subredditName: string;
  startedAt: number;
  state: 'pending' | 'removed' | 'review_requested';
};

const STATE_LABEL: Record<AppealRecord['state'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#b76e00' },
  removed: { label: 'Removed', color: '#888' },
  review_requested: { label: 'Review requested', color: '#1a6f3c' },
};

export function AppealsPage({ token }: { token: string }) {
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/appeals', { headers: { 'X-Session-Token': token } })
      .then(r => r.json())
      .then(setAppeals)
      .catch(() => setError('Failed to load appeals.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: '#c00' }}>{error}</p>;
  if (appeals.length === 0) return <p style={{ color: '#888', fontSize: '0.875rem' }}>No active appeals.</p>;

  const sorted = [...appeals].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
            <th style={TH}>Post</th>
            <th style={TH}>Author</th>
            <th style={TH}>State</th>
            <th style={TH}>Started</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(a => {
            const { label, color } = STATE_LABEL[a.state];
            return (
              <tr key={a.postId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={TD}>
                  <a href={a.postUrl} target="_blank" rel="noreferrer" style={{ color: '#0079d3' }}>
                    {a.postTitle.length > 60 ? a.postTitle.slice(0, 60) + '…' : a.postTitle}
                  </a>
                </td>
                <td style={TD}>u/{a.authorName}</td>
                <td style={TD}><span style={{ color, fontWeight: 600 }}>{label}</span></td>
                <td style={TD}>{new Date(a.startedAt).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TH: React.CSSProperties = { padding: '0.4rem 0.6rem', fontWeight: 700, color: '#333' };
const TD: React.CSSProperties = { padding: '0.5rem 0.6rem', verticalAlign: 'top' };
