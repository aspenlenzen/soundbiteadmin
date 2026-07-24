import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/auth';
import { APP_ROOMS, LEGACY_ROOMS, LEVELS, TAGS, levelFor, tagLabel } from '../lib/levels';
import { ADMIN_USER_IDS } from '../lib/config';
import { formatInTz, fromDatetimeLocal, toDatetimeLocal } from '../lib/datetime';
import SoundLevelSlider from '../components/SoundLevelSlider';
import { LevelBadge, StatTile, useToast, type Toast } from '../components/ui';
import type { Rating, RestaurantOption } from '../lib/types';

const SELECT = `id, created_at, google_place_id, sound_rating, comment, room, rated_datetime, tags, user_id, rated_timezone,
  restaurant:ratings_db_google_place_id_fkey(restaurant_name, city, google_maps_uri)`;

type SortKey = 'rated' | 'restaurant' | 'level' | 'user';

// Count of bites per level, one bar per level 1–7. Identity is carried by
// position and the label; the level color is redundant decoration. Clicking a
// bar toggles that level as a table filter.
function LevelDistribution({
  counts,
  active,
  onToggle,
}: {
  counts: number[];
  active: Set<number>;
  onToggle: (level: number) => void;
}) {
  const max = Math.max(1, ...counts);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
        Level distribution
      </p>
      <div className="mt-2 flex items-end gap-1">
        {LEVELS.map((lvl, i) => {
          const count = counts[i];
          const isActive = active.has(lvl.rating);
          const dimmed = active.size > 0 && !isActive;
          return (
            <button
              key={lvl.rating}
              onClick={() => onToggle(lvl.rating)}
              className="group relative flex flex-1 flex-col items-center"
              aria-pressed={isActive}
              aria-label={`${lvl.word}: ${count} bites${isActive ? ' (filtering)' : ''}`}
            >
              <span className="pointer-events-none absolute -top-7 z-10 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                {lvl.word} · {count}
              </span>
              <span className="text-[10px] leading-none text-gray-500">{count}</span>
              <span
                className="mt-1 w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: `${Math.max(count === 0 ? 2 : 4, (count / max) * 48)}px`,
                  backgroundColor: count === 0 ? '#E5E7EB' : lvl.color,
                  opacity: dimmed ? 0.3 : 1,
                  outline: isActive ? `2px solid ${lvl.color}` : undefined,
                  outlineOffset: '1px',
                }}
              />
              <span
                className={`mt-1 text-[10px] leading-none ${isActive ? 'font-bold text-gray-800' : 'text-gray-400'}`}
              >
                {lvl.rating}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">1 nearly silent · 7 ear-splitting — click to filter</p>
    </div>
  );
}

function EditModal({
  rating,
  restaurants,
  onClose,
  onChanged,
  toast,
}: {
  rating: Rating;
  restaurants: RestaurantOption[] | null;
  onClose: () => void;
  onChanged: () => void;
  toast: (t: Toast) => void;
}) {
  const { session, profileFor, profiles } = useAuth();
  const isOwner = !!session && session.user.id === rating.user_id;
  const isAdmin = !!session && ADMIN_USER_IDS.has(session.user.id);
  const canEdit = isOwner || isAdmin;

  const [level, setLevel] = useState(rating.sound_rating);
  const [placeId, setPlaceId] = useState(rating.google_place_id);
  const [placeQuery, setPlaceQuery] = useState(rating.restaurant?.restaurant_name ?? '');
  const [placeOpen, setPlaceOpen] = useState(false);
  const [userId, setUserId] = useState(rating.user_id);
  const [room, setRoom] = useState(rating.room ?? '');
  const [tags, setTags] = useState<string[]>(rating.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [comment, setComment] = useState(rating.comment ?? '');
  const [when, setWhen] = useState(toDatetimeLocal(rating.rated_datetime, rating.rated_timezone));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const author = profileFor(rating.user_id);
  const authorName = author?.display_name || author?.username || `${rating.user_id.slice(0, 8)}…`;
  const selfName = session
    ? profileFor(session.user.id)?.display_name || session.user.email
    : null;

  const toggleTag = (tag: string) =>
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));

  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag('');
  };

  const roomOptions = useMemo(() => {
    const known = new Set([...APP_ROOMS, ...LEGACY_ROOMS]);
    const extra = rating.room && !known.has(rating.room) ? [rating.room] : [];
    return { extra };
  }, [rating.room]);

  const selectedPlace = useMemo(
    () => restaurants?.find((r) => r.google_place_id === placeId),
    [restaurants, placeId],
  );

  const placeMatches = useMemo(() => {
    if (!restaurants) return [];
    const q = placeQuery.trim().toLowerCase();
    const list = q
      ? restaurants.filter(
          (r) =>
            (r.restaurant_name ?? '').toLowerCase().includes(q) ||
            (r.city ?? '').toLowerCase().includes(q),
        )
      : restaurants;
    return list.slice(0, 8);
  }, [restaurants, placeQuery]);

  const profileList = useMemo(() => {
    const list = [...profiles.values()].sort((a, b) =>
      (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? ''),
    );
    if (!profiles.has(userId)) {
      list.push({ id: userId, username: null, display_name: `${userId.slice(0, 8)}…` });
    }
    return list;
  }, [profiles, userId]);

  const save = async () => {
    setBusy(true);
    const patch = {
      sound_rating: level,
      google_place_id: placeId,
      user_id: userId,
      room: room || null,
      tags: tags.length ? tags : null,
      comment: comment.trim() || null,
      rated_datetime: when ? fromDatetimeLocal(when, rating.rated_timezone) : null,
    };
    const { data, error } = await supabase
      .from('Ratings db')
      .update(patch)
      .eq('id', rating.id)
      .select('id');
    setBusy(false);
    if (error) {
      toast({ kind: 'err', msg: `Save failed: ${error.message}` });
    } else if (!data?.length) {
      toast({ kind: 'err', msg: 'Save blocked — you can only edit Sound Bites posted by the signed-in account.' });
    } else {
      toast({ kind: 'ok', msg: `Sound Bite #${rating.id} updated.` });
      onChanged();
      onClose();
    }
  };

  const remove = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from('Ratings db')
      .delete()
      .eq('id', rating.id)
      .select('id');
    setBusy(false);
    if (error) {
      toast({ kind: 'err', msg: `Delete failed: ${error.message}` });
    } else if (!data?.length) {
      toast({ kind: 'err', msg: 'Delete blocked — you can only delete Sound Bites posted by the signed-in account.' });
    } else {
      toast({ kind: 'ok', msg: `Sound Bite #${rating.id} deleted.` });
      onChanged();
      onClose();
    }
  };

  const disabled = !canEdit || busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">
                {rating.restaurant?.restaurant_name ?? 'Unknown restaurant'}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Sound Bite #{rating.id} · by {authorName} · added{' '}
                {formatInTz(rating.created_at, null, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          {!session && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Read-only — sign in (top right) to edit or delete.
            </p>
          )}
          {session && !canEdit && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Read-only — signed in as {selfName}, but this bite belongs to {authorName}. Supabase
              only lets the author change it.
            </p>
          )}
          {isAdmin && !isOwner && (
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Editing as admin — this bite was posted by {authorName}.
            </p>
          )}
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-gray-700">Restaurant</p>
            <div className="relative mt-1.5">
              <input
                value={placeQuery}
                disabled={disabled || !restaurants}
                placeholder={restaurants ? 'Search restaurants…' : 'Loading restaurants…'}
                onChange={(e) => {
                  setPlaceQuery(e.target.value);
                  setPlaceOpen(true);
                }}
                onFocus={(e) => {
                  setPlaceOpen(true);
                  e.target.select();
                }}
                onBlur={() =>
                  window.setTimeout(() => {
                    setPlaceOpen(false);
                    setPlaceQuery(
                      selectedPlace?.restaurant_name ?? rating.restaurant?.restaurant_name ?? '',
                    );
                  }, 150)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none disabled:bg-gray-50"
              />
              {placeOpen && !disabled && restaurants && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {placeMatches.map((r) => (
                    <li key={r.google_place_id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPlaceId(r.google_place_id);
                          setPlaceQuery(r.restaurant_name ?? '');
                          setPlaceOpen(false);
                        }}
                        className={`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                          r.google_place_id === placeId ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="truncate font-medium">
                          {r.restaurant_name ?? 'Unnamed'}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400">{r.city ?? ''}</span>
                      </button>
                    </li>
                  ))}
                  {placeMatches.length === 0 && (
                    <li className="px-3 py-2 text-xs text-gray-400">No restaurants match</li>
                  )}
                </ul>
              )}
            </div>
            {placeId !== rating.google_place_id && (
              <p className="mt-1 text-[11px] text-amber-700">
                Moving this bite to {selectedPlace?.restaurant_name ?? 'another restaurant'} —
                both restaurants' averages will update on save.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700">Sound level</p>
            <div className="mt-3">
              <SoundLevelSlider value={level} onChange={setLevel} disabled={disabled} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-gray-700">
              Room
              <select
                value={room}
                disabled={disabled}
                onChange={(e) => setRoom(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal focus:border-[var(--accent)] focus:outline-none disabled:bg-gray-50"
              >
                <option value="">Not specified</option>
                {APP_ROOMS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <optgroup label="Legacy values">
                  {LEGACY_ROOMS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  {roomOptions.extra.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Rated at
              <input
                type="datetime-local"
                value={when}
                disabled={disabled}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-[var(--accent)] focus:outline-none disabled:bg-gray-50"
              />
              <span className="mt-1 block text-[11px] font-normal text-gray-400">
                {rating.rated_timezone
                  ? `Times in ${rating.rated_timezone}`
                  : 'No timezone stored — treated as your local time'}
              </span>
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Posted by
              <select
                value={userId}
                disabled={disabled || !isAdmin}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal focus:border-[var(--accent)] focus:outline-none disabled:bg-gray-50"
              >
                {profileList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.username || `${p.id.slice(0, 8)}…`}
                  </option>
                ))}
              </select>
              {canEdit && !isAdmin && (
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  Only the admin account can change the author.
                </span>
              )}
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700">Tags</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...TAGS, ...tags.filter((t) => !TAGS.includes(t))].map((tag) => {
                const on = tags.includes(tag);
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

          <label className="block text-sm font-semibold text-gray-700">
            Comment
            <textarea
              value={comment}
              disabled={disabled}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="No comment"
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-[var(--accent)] focus:outline-none disabled:bg-gray-50"
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          {canEdit ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-red-700">Delete forever?</span>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete…
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
    </div>
  );
}

export default function RatingsPage() {
  const { profileFor } = useAuth();
  const [ratings, setRatings] = useState<Rating[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [restaurantFilter, setRestaurantFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rated', dir: -1 });
  const [editing, setEditing] = useState<Rating | null>(null);
  const { show: showToast, node: toastNode } = useToast();
  const [restaurants, setRestaurants] = useState<RestaurantOption[] | null>(null);

  useEffect(() => {
    supabase
      .from('Restaurants db')
      .select('google_place_id, restaurant_name, city')
      .order('restaurant_name')
      .limit(1000)
      .then(({ data }) => setRestaurants((data ?? []) as RestaurantOption[]));
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase.from('Ratings db').select(SELECT).limit(1000);
    if (error) {
      setLoadError(error.message);
    } else {
      setRatings((data ?? []) as unknown as Rating[]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const userName = useCallback(
    (id: string) => {
      const p = profileFor(id);
      return p?.display_name || p?.username || `${id.slice(0, 8)}…`;
    },
    [profileFor],
  );

  const rooms = useMemo(
    () => [...new Set((ratings ?? []).map((r) => r.room).filter((r): r is string => !!r))].sort(),
    [ratings],
  );
  const users = useMemo(
    () => [...new Set((ratings ?? []).map((r) => r.user_id))].sort((a, b) => userName(a).localeCompare(userName(b))),
    [ratings, userName],
  );
  const ratedRestaurants = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of ratings ?? []) {
      if (!m.has(r.google_place_id)) {
        m.set(r.google_place_id, r.restaurant?.restaurant_name ?? r.google_place_id);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ratings]);

  const ratedInstant = (r: Rating) => new Date(r.rated_datetime ?? r.created_at).getTime();

  const visible = useMemo(() => {
    if (!ratings) return [];
    const q = search.trim().toLowerCase();
    const rows = ratings.filter((r) => {
      if (levelFilter.size && !levelFilter.has(r.sound_rating)) return false;
      if (roomFilter && r.room !== roomFilter) return false;
      if (userFilter && r.user_id !== userFilter) return false;
      if (restaurantFilter && r.google_place_id !== restaurantFilter) return false;
      const instant = ratedInstant(r);
      if (dateFrom && instant < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && instant > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
      if (!q) return true;
      const hay = [
        r.restaurant?.restaurant_name,
        r.restaurant?.city,
        r.comment,
        r.room,
        ...(r.tags ?? []),
        userName(r.user_id),
        levelFor(r.sound_rating)?.word,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    const cmp: Record<SortKey, (a: Rating, b: Rating) => number> = {
      rated: (a, b) => ratedInstant(a) - ratedInstant(b),
      restaurant: (a, b) =>
        (a.restaurant?.restaurant_name ?? '').localeCompare(b.restaurant?.restaurant_name ?? ''),
      level: (a, b) => a.sound_rating - b.sound_rating || ratedInstant(a) - ratedInstant(b),
      user: (a, b) =>
        userName(a.user_id).localeCompare(userName(b.user_id)) || ratedInstant(b) - ratedInstant(a),
    };
    return rows.sort((a, b) => cmp[sort.key](a, b) * sort.dir);
  }, [ratings, search, roomFilter, userFilter, restaurantFilter, dateFrom, dateTo, levelFilter, sort, userName]);

  const stats = useMemo(() => {
    if (!ratings || ratings.length === 0) return null;
    const counts = LEVELS.map((l) => ratings.filter((r) => r.sound_rating === l.rating).length);
    const total = ratings.length;
    const avg = ratings.reduce((s, r) => s + r.sound_rating, 0) / total;
    const places = new Set(ratings.map((r) => r.google_place_id)).size;
    const topIdx = counts.indexOf(Math.max(...counts));
    const latest = ratings.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    return { counts, total, avg, places, top: LEVELS[topIdx], topCount: counts[topIdx], latest };
  }, [ratings]);

  const hasFilters =
    !!search ||
    !!roomFilter ||
    !!userFilter ||
    !!restaurantFilter ||
    !!dateFrom ||
    !!dateTo ||
    levelFilter.size > 0;

  const clearFilters = () => {
    setSearch('');
    setRoomFilter('');
    setUserFilter('');
    setRestaurantFilter('');
    setDateFrom('');
    setDateTo('');
    setLevelFilter(new Set());
  };

  const toggleLevel = (level: number) =>
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'id', 'restaurant', 'city', 'level', 'level_word', 'room', 'tags', 'comment',
      'rated_datetime_utc', 'rated_timezone', 'user', 'created_at',
    ];
    const lines = visible.map((r) =>
      [
        r.id,
        r.restaurant?.restaurant_name,
        r.restaurant?.city,
        r.sound_rating,
        levelFor(r.sound_rating)?.word,
        r.room,
        (r.tags ?? []).join('|'),
        r.comment,
        r.rated_datetime,
        r.rated_timezone,
        userName(r.user_id),
        r.created_at,
      ]
        .map(esc)
        .join(','),
    );
    const blob = new Blob([[header.map(esc).join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `soundbites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const headerBtn = (key: SortKey, label: string) => (
    <button
      onClick={() =>
        setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : -1 }))
      }
      className={`inline-flex items-center gap-1 ${sort.key === key ? 'text-gray-900' : ''}`}
    >
      {label}
      {sort.key === key && <span className="text-[10px]">{sort.dir === -1 ? '▼' : '▲'}</span>}
    </button>
  );

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold">Couldn't load Sound Bites</p>
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

  if (!ratings) {
    return <p className="py-24 text-center text-sm text-gray-400">Loading Sound Bites…</p>;
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <StatTile
            label="Sound Bites"
            value={stats.total}
            sub={`across ${stats.places} restaurants`}
          />
          <StatTile
            label="Average level"
            value={
              <span className="flex items-baseline gap-2">
                {stats.avg.toFixed(1)}
                <span className="text-sm font-semibold text-gray-500">
                  {levelFor(Math.round(stats.avg))?.word}
                </span>
              </span>
            }
            sub="1 nearly silent · 7 ear-splitting"
          />
          <StatTile
            label="Most common"
            value={<LevelBadge rating={stats.top.rating} />}
            sub={`${stats.topCount} bites`}
          />
          <StatTile
            label="Latest bite"
            value={formatInTz(stats.latest.created_at, null, { month: 'long', day: 'numeric' })}
            sub={`by ${userName(stats.latest.user_id)}`}
          />
          <div className="col-span-2 xl:col-span-1">
            <LevelDistribution counts={stats.counts} active={levelFilter} onToggle={toggleLevel} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search restaurant, comment, tag, user…"
          className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All users</option>
          {users.map((id) => (
            <option key={id} value={id}>{userName(id)}</option>
          ))}
        </select>
        <select
          value={restaurantFilter}
          onChange={(e) => setRestaurantFilter(e.target.value)}
          className="max-w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All restaurants</option>
          {ratedRestaurants.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none"
          />
        </label>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--accent)] hover:bg-blue-50"
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {visible.length} of {ratings.length}
          </span>
          <button
            onClick={exportCsv}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={load}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">{headerBtn('rated', 'Rated')}</th>
              <th className="px-4 py-3">{headerBtn('restaurant', 'Restaurant')}</th>
              <th className="px-4 py-3">{headerBtn('level', 'Level')}</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Comment</th>
              <th className="px-4 py-3">{headerBtn('user', 'User')}</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.id}
                onClick={() => setEditing(r)}
                className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="font-medium">
                    {r.rated_datetime
                      ? formatInTz(r.rated_datetime, r.rated_timezone, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.rated_datetime
                      ? formatInTz(r.rated_datetime, r.rated_timezone, {
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short',
                        })
                      : 'no date'}
                  </p>
                </td>
                <td className="max-w-52 px-4 py-3">
                  <p className="truncate font-medium">
                    {r.restaurant?.restaurant_name ?? (
                      <span className="text-gray-400 italic">unknown</span>
                    )}
                    {r.restaurant?.google_maps_uri && (
                      <a
                        href={r.restaurant.google_maps_uri}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open in Google Maps"
                        className="ml-1.5 text-xs text-[var(--accent)] hover:underline"
                      >
                        ↗
                      </a>
                    )}
                  </p>
                  {r.restaurant?.city && (
                    <p className="truncate text-xs text-gray-400">{r.restaurant.city}</p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <LevelBadge rating={r.sound_rating} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {r.room ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {r.tags?.length ? (
                    <span className="flex flex-wrap gap-1">
                      {r.tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs whitespace-nowrap text-gray-600"
                        >
                          {tagLabel(t)}
                        </span>
                      ))}
                      {r.tags.length > 2 && (
                        <span className="text-xs text-gray-400" title={r.tags.slice(2).join(', ')}>
                          +{r.tags.length - 2}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="max-w-48 px-4 py-3">
                  {r.comment ? (
                    <p className="truncate text-gray-600" title={r.comment}>
                      {r.comment}
                    </p>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{userName(r.user_id)}</td>
                <td className="px-2 py-3 text-gray-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-400">
                  No Sound Bites match{hasFilters ? ' the current filters' : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          rating={editing}
          restaurants={restaurants}
          onClose={() => setEditing(null)}
          onChanged={load}
          toast={showToast}
        />
      )}

      {toastNode}
    </div>
  );
}
