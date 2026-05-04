import { useEffect, useState } from 'react';

type ResponseLocation = 'post' | 'comment' | 'both';
type SavedResponse = { id: string; title: string; body: string; location: ResponseLocation };
type EditState = { id: string; title: string; body: string; location: ResponseLocation } | null;

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

function ResponseCard({
  resp,
  token,
  onUpdated,
  onDeleted,
}: {
  resp: SavedResponse;
  token: string;
  onUpdated: (updated: SavedResponse) => void;
  onDeleted: (id: string) => void;
}) {
  const [edit, setEdit] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/saved-responses/${edit.id}`, {
        method: 'PUT',
        headers: { 'X-Session-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: edit.title, body: edit.body, location: edit.location }),
      });
      if (!r.ok) throw new Error(await r.text());
      onUpdated(await r.json());
      setEdit(null);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm(`Delete "${resp.title}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/saved-responses/${resp.id}`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': token },
      });
      onDeleted(resp.id);
    } finally {
      setDeleting(false);
    }
  }

  if (edit) {
    return (
      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: '0.875rem', marginBottom: '0.75rem' }}>
        <input
          style={{ ...INPUT_STYLE, marginBottom: '0.5rem' }}
          value={edit.title}
          onChange={e => setEdit({ ...edit, title: e.target.value })}
          placeholder="Title"
        />
        <textarea
          style={{ ...INPUT_STYLE, height: 96, resize: 'vertical', marginBottom: '0.5rem' }}
          value={edit.body}
          onChange={e => setEdit({ ...edit, body: e.target.value })}
          placeholder="Body"
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={save} disabled={saving} style={btnStyle('#ff4500')}>{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={() => setEdit(null)} style={btnStyle('#888')}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '0.875rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem' }}>{resp.title}</strong>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button onClick={() => setEdit({ id: resp.id, title: resp.title, body: resp.body, location: resp.location })} style={btnStyle('#555')}>Edit</button>
          <button onClick={del} disabled={deleting} style={btnStyle('#c00')}>{deleting ? '…' : 'Delete'}</button>
        </div>
      </div>
      <pre style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#444', fontFamily: 'inherit' }}>{resp.body}</pre>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return { padding: '0.3rem 0.75rem', background: color, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };
}

export function SavedResponsesPage({ token }: { token: string }) {
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/saved-responses', { headers: { 'X-Session-Token': token } })
      .then(r => r.json())
      .then(setResponses)
      .catch(() => setError('Failed to load saved responses.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function add() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const r = await fetch('/api/saved-responses', {
        method: 'POST',
        headers: { 'X-Session-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      const created: SavedResponse = await r.json();
      setResponses(prev => [...prev, created]);
      setNewTitle('');
      setNewBody('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  const sorted = [...responses].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

  return (
    <div>
      {error && <div style={{ color: '#c00', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '0.875rem', marginBottom: '1.5rem', background: '#fafafa' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Add new response</h3>
        <input
          style={{ ...INPUT_STYLE, marginBottom: '0.5rem' }}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Title"
        />
        <textarea
          style={{ ...INPUT_STYLE, height: 80, resize: 'vertical', marginBottom: '0.5rem' }}
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
          placeholder="Body (markdown)"
        />
        <button
          onClick={add}
          disabled={adding || !newTitle.trim() || !newBody.trim()}
          style={{ ...btnStyle('#ff4500'), opacity: !newTitle.trim() || !newBody.trim() ? 0.5 : 1 }}
        >
          {adding ? 'Adding…' : 'Add response'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.875rem' }}>No saved responses yet.</p>
      ) : (
        sorted.map(r => (
          <ResponseCard
            key={r.id}
            resp={r}
            token={token}
            onUpdated={updated => setResponses(prev => prev.map(x => x.id === updated.id ? updated : x))}
            onDeleted={id => setResponses(prev => prev.filter(x => x.id !== id))}
          />
        ))
      )}
    </div>
  );
}
