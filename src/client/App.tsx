import { useState } from 'react';
import { SettingsPage } from './pages/Settings';
import { SavedResponsesPage } from './pages/SavedResponses';
import { AppealsPage } from './pages/Appeals';
import { LogsPage } from './pages/Logs';

type Tab = 'settings' | 'saved-responses' | 'appeals' | 'logs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'saved-responses', label: 'Saved Responses' },
  { id: 'appeals', label: 'Appeals' },
  { id: 'logs', label: 'Logs' },
];

export function App({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>('settings');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', color: '#1a1a1a' }}>
        llmphysics-bot — Mod Dashboard
      </h1>
      <nav style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid #e0e0e0', marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? '#ff4500' : '#555',
              borderBottom: tab === t.id ? '2px solid #ff4500' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'settings' && <SettingsPage token={token} />}
      {tab === 'saved-responses' && <SavedResponsesPage token={token} />}
      {tab === 'appeals' && <AppealsPage token={token} />}
      {tab === 'logs' && <LogsPage token={token} />}
    </div>
  );
}
