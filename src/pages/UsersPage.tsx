import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/auth';
import { ADMIN_USER_IDS } from '../lib/config';
import { TAGS, tagLabel } from '../lib/levels';
import { formatInTz } from '../lib/datetime';
import { LevelBadge, StatTile, TierBadge, useToast, type Toast } from '../components/ui';

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  rating_count: number;
  important_tags: string[] | null;
  subscription_tier: string | null;
  created_at: string;
};

type RatingLite = { user_id: string; sound_rating: number; created_at: string };

function Avatar({ profile, size = 36 }: { profile: ProfileRow; size?: number }) {
  const name = profile.display_name || profile.username || '?';
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-[var(--accent)] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function EditUserModal({
  row,
  onClose,
  onChanged,
  toast,
}: {
  row: ProfileRow;
  onClose: () => void;
  onChanged: () => void;
  toast: (t: Toast) => void;
}) {
  const { session } = useAuth();
  const isAdmin = !!session && ADMIN_USER_IDS.has(session.user.id);
  const isSelf = !!session && session.user.id === row.id;
  const canEdit = isAdmin || isSelf;

  const [displayName, setDisplayName] = useState(row.display_name ?? '');
  const [username, setUsername] = useState(row.username ?? '');
  const [email, setEmail] = useState(row.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState(row.avatar_url ?? '');
  const [tier, setTier] = useState((row.subscription_tier ?? 'free').toLowerCase());
  const [importantTags, setImportantTags] = useState<string[]>(row.important_tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const disabled = !canEdit || busy;

  const toggleTag = (tag: string) =>
    setImportantTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));

  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !importantTags.includes(t)) setImportantTags((prev) => [...prev, t]);
    setCustomTag('');
  };

  const save = async () => {
    setBusy(true);
    const patch = {
      display_name: displayName.trim() || null,
      username: username.trim() || null,
      email: email.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      subscription_tier: tier,
      important_tags: importantTags.length ? importantTags : null,
    };
    const { data, error } = await supabase
      .from('user db')
      .update(patch)
      .eq('id', row.id)
      .select('id');
    setBusy(false);
    if (error) {
      toast({ kind: 'err', msg: `Save failed: ${error.message}` });
    } else if (!data?.length) {
      toast({ kind: 'err', msg: 'Save blocked — you can only edit your own profile (or use the admin account).' });
    } else {
      toast({ kind: 'ok', msg: `${displayName.trim() || username.trim() || 'Profile'} updated.` });
      onChanged();
      onClose();
    }
  };

  const field =
    'mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-[var(--accent)] focus:outline-none disabled:bg-gray-50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar profile={row} size={40} />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">
                  {row.display_name || row.username || 'Profile'}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {row.rating_count} Sound Bite{row.rating_count === 1 ? '' : 's'} · joined{' '}
                  {formatInTz(row.created_at, null, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          {!canEdit && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Read-only — sign in as this user or the admin account to edit.
            </p>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-gray-700">
              Display name
              <input value={displayName} disabled={disabled} onChange={(e) => setDisplayName(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Username
              <input value={username} disabled={disabled} onChange={(e) => setUsername(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Email (profile)
            <input value={email} disabled={disabled} onChange={(e) => setEmail(e.target.value)} className={field} />
            <span className="mt-1 block text-[11px] font-normal text-gray-400">
              Display email on the profile — changing it does not change the login email.
            </span>
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Avatar URL
            <input value={avatarUrl} disabled={disabled} onChange={(e) => setAvatarUrl(e.target.value)} className={field} />
          </label>
          <div>
            <p className="text-sm font-semibold text-gray-700">Membership tier</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Sets the user's tier directly — Pro unlocks the app's paid features.
            </p>
            <div className="mt-2 inline-flex rounded-lg border border-gray-200 p-0.5">
              {['free', 'pro'].map((t) => {
                const on = tier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTier(t)}
                    className={`rounded-md px-6 py-1.5 text-sm font-semibold capitalize transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      on ? 'bg-[var(--accent)] text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Important tags</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              The tags this user cares about most in the app.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...TAGS, ...importantTags.filter((t) => !TAGS.includes(t))].map((tag) => {
                const on = importantTags.includes(tag);
                return (
                  <button
                    key={tag}
                    disabled={disabled}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed ${
                      on
                        ? 'border-[var(--accent)] bg-blue-50 text-[var(--accent)]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {tagLabel(tag)}
                    {on && <span className="ml-1">✕</span>}
                  </button>
                );
              })}
            </div>
            {!disabled && (
              <div className="mt-2 flex gap-2">
                <input
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="Add a custom tag…"
                  className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  onClick={addCustomTag}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            {canEdit ? 'Cancel' : 'Close'}
          </button>
          {canEdit && (
            <button
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [ratings, setRatings] = useState<RatingLite[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const { show: showToast, node: toastNode } = useToast();

  const load = useCallback(async () => {
    setLoadError(null);
    const [profiles, ratingRows] = await Promise.all([
      supabase
        .from('user db')
        .select('id, username, display_name, email, avatar_url, rating_count, important_tags, subscription_tier, created_at')
        .order('created_at')
        .limit(1000),
      supabase.from('Ratings db').select('user_id, sound_rating, created_at').limit(1000),
    ]);
    if (profiles.error) {
      setLoadError(profiles.error.message);
      return;
    }
    setRows((profiles.data ?? []) as ProfileRow[]);
    setRatings((ratingRows.data ?? []) as RatingLite[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const perUser = useMemo(() => {
    const m = new Map<string, { count: number; sum: number; last: string }>();
    for (const r of ratings) {
      const cur = m.get(r.user_id) ?? { count: 0, sum: 0, last: '' };
      cur.count += 1;
      cur.sum += r.sound_rating;
      if (r.created_at > cur.last) cur.last = r.created_at;
      m.set(r.user_id, cur);
    }
    return m;
  }, [ratings]);

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const totalBites = rows.reduce((s, r) => s + r.rating_count, 0);
    const top = [...rows].sort((a, b) => b.rating_count - a.rating_count)[0];
    const newest = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return { total: rows.length, totalBites, top, newest };
  }, [rows]);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold">Couldn't load users</p>
        <p className="mt-1">{loadError}</p>
        <button
          onClick={load}
          className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!rows) {
    return <p className="py-24 text-center text-sm text-gray-400">Loading users…</p>;
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile label="Members" value={stats.total} />
          <StatTile label="Sound Bites" value={stats.totalBites} sub="all users combined" />
          <StatTile
            label="Most active"
            value={stats.top.display_name || stats.top.username || '—'}
            sub={`${stats.top.rating_count} bites`}
          />
          <StatTile
            label="Newest member"
            value={stats.newest.display_name || stats.newest.username || '—'}
            sub={`joined ${formatInTz(stats.newest.created_at, null, { month: 'long', day: 'numeric' })}`}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Sound Bites</th>
              <th className="px-4 py-3">Avg level</th>
              <th className="px-4 py-3">Last bite</th>
              <th className="px-4 py-3">Important tags</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const agg = perUser.get(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => setEditing(r)}
                  className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar profile={r} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {r.display_name ?? <span className="text-gray-400 italic">no name</span>}
                        </p>
                        {r.username && (
                          <p className="truncate text-xs text-gray-400">@{r.username}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {r.email ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TierBadge tier={r.subscription_tier} />
                  </td>
                  <td className="px-4 py-3 font-medium">{r.rating_count}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {agg && agg.count > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <LevelBadge rating={Math.round(agg.sum / agg.count)} />
                        <span className="text-xs text-gray-500">
                          {(agg.sum / agg.count).toFixed(1)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {agg?.last ? (
                      formatInTz(agg.last, null, { year: 'numeric', month: 'long', day: 'numeric' })
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.important_tags?.length ? (
                      <span className="flex flex-wrap gap-1">
                        {r.important_tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs whitespace-nowrap text-gray-600"
                          >
                            {tagLabel(t)}
                          </span>
                        ))}
                        {r.important_tags.length > 3 && (
                          <span
                            className="text-xs text-gray-400"
                            title={r.important_tags.slice(3).join(', ')}
                          >
                            +{r.important_tags.length - 3}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {formatInTz(r.created_at, null, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                  <td className="px-2 py-3 text-gray-300">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditUserModal
          row={editing}
          onClose={() => setEditing(null)}
          onChanged={load}
          toast={showToast}
        />
      )}

      {toastNode}
    </div>
  );
}
