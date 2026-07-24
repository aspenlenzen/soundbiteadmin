import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { missingSupabaseConfig } from './lib/supabase';

// Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY weren't available at
// build time. Uses inline styles so it renders even if nothing else loaded.
function ConfigError() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#f9fafb',
        color: '#111827',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Supabase configuration missing</h1>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: '#4b5563' }}>
          This build has no Supabase credentials, so the dashboard can't connect. Set both
          environment variables in your host (e.g. Vercel → Settings → Environment Variables),
          then trigger a new deployment — Vite only reads them at build time.
        </p>
        <pre
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: '#111827',
            color: '#e5e7eb',
            borderRadius: 10,
            fontSize: 13,
            overflowX: 'auto',
          }}
        >
          VITE_SUPABASE_URL{'\n'}VITE_SUPABASE_ANON_KEY
        </pre>
        <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
          Locally, copy <code>.env.example</code> to <code>.env</code> and fill them in.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{missingSupabaseConfig ? <ConfigError /> : <App />}</StrictMode>,
);
