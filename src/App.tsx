import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/auth';
import { supabase } from './lib/supabase';
import RatingsPage from './pages/RatingsPage';
import RestaurantsPage from './pages/RestaurantsPage';
import UsersPage from './pages/UsersPage';

type PageDef = { slug: string; label: string; icon: ReactNode; title: string };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const PAGES: PageDef[] = [
  {
    slug: 'ratings',
    label: 'Sound Bites',
    title: 'Sound Bites',
    icon: icon('M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12'),
  },
  {
    slug: 'restaurants',
    label: 'Restaurants',
    title: 'Restaurants',
    icon: icon('M4 10 5 3h14l1 7M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M5 10v11h14V10M9 21v-6h6v6'),
  },
  {
    slug: 'users',
    label: 'Users',
    title: 'Users',
    icon: icon('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75'),
  },
  {
    slug: 'favorites',
    label: 'Favorites',
    title: 'Favorites',
    icon: icon('M19 14c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3.4 1-4.5 2.5C10.9 4 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.1 3 5.5l7 6.5 7-6.5Z'),
  },
];

const pageFromHash = () => {
  const slug = window.location.hash.replace(/^#\/?/, '');
  return PAGES.some((p) => p.slug === slug) ? slug : 'ratings';
};

function SignInModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold">Sign in</h2>
        <p className="mt-1 text-sm text-gray-500">
          Use your SoundBite app account. You can only edit Sound Bites posted by the account you
          sign in with.
        </p>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AuthChip() {
  const { session, ready, profileFor } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

  if (!ready) return null;

  if (!session) {
    return (
      <>
        <button
          onClick={() => setShowSignIn(true)}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </button>
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
      </>
    );
  }

  const profile = profileFor(session.user.id);
  const name = profile?.display_name || profile?.username || session.user.email || 'Signed in';
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <span className="text-sm font-medium text-gray-700">{name}</span>
      <button
        onClick={() => supabase.auth.signOut()}
        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
      >
        Sign out
      </button>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-center">
      <p className="text-lg font-semibold text-gray-400">{title} — coming soon</p>
      <p className="mt-1 text-sm text-gray-400">This section hasn't been built yet.</p>
    </div>
  );
}

function Shell() {
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const current = PAGES.find((p) => p.slug === page) ?? PAGES[0];

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 12v0M8 8v8M12 5v14M16 8v8M20 12v0" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold leading-tight">SoundBite</p>
            <p className="text-[11px] font-medium tracking-wide text-gray-400">ADMIN</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {PAGES.map((p) => (
            <a
              key={p.slug}
              href={`#/${p.slug}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                p.slug === current.slug
                  ? 'bg-blue-50 text-[var(--accent)]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.icon}
              {p.label}
            </a>
          ))}
        </nav>
        <p className="mt-auto px-5 pb-5 text-[11px] leading-relaxed text-gray-400">
          Connected to the live SoundBite database.
        </p>
      </aside>

      <div className="ml-56 flex-1">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white/90 px-8 py-3.5 backdrop-blur">
          <h1 className="text-lg font-bold">{current.title}</h1>
          <AuthChip />
        </header>
        <main className="px-8 py-6">
          {current.slug === 'ratings' && <RatingsPage />}
          {current.slug === 'restaurants' && <RestaurantsPage />}
          {current.slug === 'users' && <UsersPage />}
          {current.slug === 'favorites' && <Placeholder title={current.title} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
