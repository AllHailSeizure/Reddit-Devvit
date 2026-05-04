import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

function Root() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (session) {
      sessionStorage.setItem('adminToken', session);
      params.delete('session');
      const clean = params.toString();
      history.replaceState(null, '', clean ? `?${clean}` : window.location.pathname);
    }
    const stored = sessionStorage.getItem('adminToken');
    setToken(stored);
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!token) return <div style={{ padding: '2rem', color: '#c00', fontFamily: 'sans-serif' }}>No session token. Please open this page from the Reddit mod menu.</div>;
  return <App token={token} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode><Root /></StrictMode>);
