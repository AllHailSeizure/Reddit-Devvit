import { useEffect, useState } from 'react';

type Settings = {
  botSignature: string;
  depthCap: number;
  depthCapNotice: string;
  appealBaseUrl: string;
};

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>{label}</label>
      {help && <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: '#666' }}>{help}</p>}
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

export function SettingsPage({ token }: { token: string }) {
  const [form, setForm] = useState<Settings>({ botSignature: '', depthCap: 10, depthCapNotice: '', appealBaseUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/settings', { headers: { 'X-Session-Token': token } })
      .then(r => r.json())
      .then((data: Settings) => setForm(data))
      .catch(() => setToast({ msg: 'Failed to load settings.', ok: false }))
      .finally(() => setLoading(false));
  }, [token]);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'X-Session-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      setToast({ msg: 'Settings saved.', ok: true });
    } catch (e) {
      setToast({ msg: `Save failed: ${(e as Error).message}`, ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      {toast && (
        <div style={{ padding: '0.6rem 1rem', marginBottom: '1rem', borderRadius: 4, background: toast.ok ? '#e6f4ea' : '#fce8e6', color: toast.ok ? '#137333' : '#c00' }}>
          {toast.msg}
        </div>
      )}

      <Field label="Bot signature" help="Appended to all bot comments. Leave blank for no signature.">
        <textarea
          style={{ ...INPUT_STYLE, height: 72, resize: 'vertical' }}
          value={form.botSignature}
          onChange={e => set('botSignature', e.target.value)}
        />
      </Field>

      <Field label="Depth cap" help="Lock comment chains at this depth. Set to 0 to disable.">
        <input
          type="number"
          style={{ ...INPUT_STYLE, width: 120 }}
          value={form.depthCap}
          min={0}
          onChange={e => set('depthCap', Number(e.target.value))}
        />
      </Field>

      <Field label="Depth cap notice" help="Message posted when a comment hits the depth cap.">
        <textarea
          style={{ ...INPUT_STYLE, height: 96, resize: 'vertical' }}
          value={form.depthCapNotice}
          onChange={e => set('depthCapNotice', e.target.value)}
        />
      </Field>

      <Field label="Appeal base URL" help="Public base URL for this bot (e.g. https://llmphysics-bot.example.devvit.net). Used to construct appeal token links.">
        <input
          type="url"
          style={INPUT_STYLE}
          value={form.appealBaseUrl}
          placeholder="https://…"
          onChange={e => set('appealBaseUrl', e.target.value)}
        />
      </Field>

      <button
        onClick={save}
        disabled={saving}
        style={{ padding: '0.5rem 1.25rem', background: '#ff4500', color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
      >
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}
