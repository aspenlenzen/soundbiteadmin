import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/auth';
import { ADMIN_USER_IDS } from '../lib/config';
import { formatInTz } from '../lib/datetime';
import { LEVELS } from '../lib/levels';
import { LevelBadge, StatTile, useToast, type Toast } from '../components/ui';

type RestaurantRow = {
  google_place_id: string;
  restaurant_name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  full_address: string | null;
  establishment_type: string | null;
  primary_type: string | null;
  rating_count: number;
  overall_average: number | null;
  google_rating: number | null;
  google_rating_count: number | null;
  google_price_level: string | null;
  google_website: string | null;
  google_phone_number: string | null;
  google_maps_uri: string | null;
  source: string | null;
  created_at: string;
};

const SELECT =
  'google_place_id, restaurant_name, street_address, city, state, postal_code, full_address, establishment_type, primary_type, rating_count, overall_average, google_rating, google_rating_count, google_price_level, google_website, google_phone_number, google_maps_uri, source, created_at';

type SortKey = 'name' | 'city' | 'type' | 'level' | 'bites' | 'google';
type BitesFilter = '' | 'with' | 'without' | '2' | '3' | '5';

// Title-cased so "american_restaurant" (Google) and "American restaurant"
// (hand-entered) collapse to one filter option.
const prettyType = (r: RestaurantRow): string | null => {
  const t = r.establishment_type ?? r.primary_type;
  if (!t) return null;
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
};

const fmtAvg = (avg: number | null): string =>
  avg == null ? '' : String(Math.round(avg * 100) / 100);

function EditRestaurantModal({
  row,
  onClose,
  onChanged,
  toast,
}: {
  row: RestaurantRow;
  onClose: () => void;
  onChanged: () => void;
  toast: (t: Toast) => void;
}) {
  const { session } = useAuth();
  const isAdmin = !!session && ADMIN_USER_IDS.has(session.user.id);

  const [name, setName] = useState(row.restaurant_name ?? '');
  const [estType, setEstType] = useState(row.establishment_type ?? '');
  const [street, setStreet] = useState(row.street_address ?? '');
  const [city, setCity] = useState(row.city ?? '');
  const [stateVal, setStateVal] = useState(row.state ?? '');
  const [postal, setPostal] = useState(row.postal_code ?? '');
  const [website, setWebsite] = useState(row.google_website ?? '');
  const [phone, setPhone] = useState(row.google_phone_number ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const disabled = !isAdmin || busy;

  const addressChanged =
    street.trim() !== (row.street_address ?? '') ||
    city.trim() !== (row.city ?? '') ||
    stateVal.trim() !== (row.state ?? '') ||
    postal.trim() !== (row.postal_code ?? '');

  const composedAddress =
    [street.trim(), city.trim(), [stateVal.trim(), postal.trim()].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ') || null;

  const save = async () => {
    setBusy(true);
    const patch = {
      restaurant_name: name.trim() || null,
      establishment_type: estType.trim() || null,
      street_address: street.trim() || null,
      city: city.trim() || null,
      state: stateVal.trim() || null,
      postal_code: postal.trim() || null,
      google_website: website.trim() || null,
      google_phone_number: phone.trim() || null,
      ...(addressChanged ? { full_address: composedAddress } : {}),
    };
    const { data, error } = await supabase
      .from('Restaurants db')
      .update(patch)
      .eq('google_place_id', row.google_place_id)
      .select('google_place_id');
    setBusy(false);
    if (error) {
      toast({ kind: 'err', msg: `Save failed: ${error.message}` });
    } else if (!data?.length) {
      toast({ kind: 'err', msg: 'Save blocked — only the admin account can edit restaurants.' });
    } else {
      toast({ kind: 'ok', msg: `${name.trim() || 'Restaurant'} updated.` });
      onChanged();
      onClose();
    }
  };

  const remove = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from('Restaurants db')
      .delete()
      .eq('google_place_id', row.google_place_id)
      .select('google_place_id');
    setBusy(false);
    if (error) {
      toast({ kind: 'err', msg: `Delete failed: ${error.message}` });
    } else if (!data?.length) {
      toast({ kind: 'err', msg: 'Delete blocked — only the admin account can delete restaurants.' });
    } else {
      toast({ kind: 'ok', msg: `${row.restaurant_name ?? 'Restaurant'} deleted.` });
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
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{row.restaurant_name ?? 'Unnamed'}</h2>
              <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
                {row.google_place_id}
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
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              {row.rating_count} Sound Bite{row.rating_count === 1 ? '' : 's'}
              {row.overall_average != null && (
                <>
                  · <LevelBadge rating={Math.round(row.overall_average)} />
                  <span>{fmtAvg(row.overall_average)}</span>
                </>
              )}
            </span>
            {row.google_rating != null && (
              <span>
                Google {row.google_rating}★ ({row.google_rating_count ?? 0})
              </span>
            )}
            {row.source && <span>source: {row.source}</span>}
            <span>added {formatInTz(row.created_at, null, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            {row.google_maps_uri && (
              <a
                href={row.google_maps_uri}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                Google Maps ↗
              </a>
            )}
          </div>
          {!isAdmin && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Read-only — only the admin account can edit restaurants.
            </p>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-gray-700">
              Name
              <input value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Establishment type
              <input
                value={estType}
                disabled={disabled}
                onChange={(e) => setEstType(e.target.value)}
                placeholder={row.primary_type ? `Google: ${row.primary_type}` : ''}
                className={field}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Street address
            <input value={street} disabled={disabled} onChange={(e) => setStreet(e.target.value)} className={field} />
          </label>
          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm font-semibold text-gray-700">
              City
              <input value={city} disabled={disabled} onChange={(e) => setCity(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              State
              <input value={stateVal} disabled={disabled} onChange={(e) => setStateVal(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Postal code
              <input value={postal} disabled={disabled} onChange={(e) => setPostal(e.target.value)} className={field} />
            </label>
          </div>
          {addressChanged && (
            <p className="text-[11px] text-gray-400">
              Full address will be saved as: {composedAddress ?? '—'}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-gray-700">
              Website
              <input value={website} disabled={disabled} onChange={(e) => setWebsite(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Phone
              <input value={phone} disabled={disabled} onChange={(e) => setPhone(e.target.value)} className={field} />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          {isAdmin && row.rating_count === 0 ? (
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
            <span className="text-[11px] text-gray-400">
              {isAdmin && row.rating_count > 0
                ? 'Restaurants with Sound Bites can’t be deleted.'
                : ''}
            </span>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              {isAdmin ? 'Cancel' : 'Close'}
            </button>
            {isAdmin && (
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

export default function RestaurantsPage() {
  const [rows, setRows] = useState<RestaurantRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bitesFilter, setBitesFilter] = useState<BitesFilter>('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'bites', dir: -1 });
  const [editing, setEditing] = useState<RestaurantRow | null>(null);
  const { show: showToast, node: toastNode } = useToast();

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from('Restaurants db')
      .select(SELECT)
      .order('restaurant_name')
      .limit(1000);
    if (error) setLoadError(error.message);
    else setRows((data ?? []) as RestaurantRow[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cities = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.city).filter((c): c is string => !!c))].sort(),
    [rows],
  );
  const types = useMemo(
    () => [...new Set((rows ?? []).map((r) => prettyType(r)).filter((t): t is string => !!t))].sort(),
    [rows],
  );

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (bitesFilter === 'with' && r.rating_count === 0) return false;
      if (bitesFilter === 'without' && r.rating_count > 0) return false;
      if ((bitesFilter === '2' || bitesFilter === '3' || bitesFilter === '5') &&
        r.rating_count < Number(bitesFilter))
        return false;
      if (cityFilter && r.city !== cityFilter) return false;
      if (typeFilter && prettyType(r) !== typeFilter) return false;
      if (
        levelFilter &&
        (r.overall_average == null || Math.round(r.overall_average) !== Number(levelFilter))
      )
        return false;
      if (!q) return true;
      const hay = [
        r.restaurant_name,
        r.city,
        r.state,
        r.street_address,
        r.full_address,
        prettyType(r),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    const nameOf = (r: RestaurantRow) => r.restaurant_name ?? '';
    const cmp: Record<SortKey, (a: RestaurantRow, b: RestaurantRow) => number> = {
      name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
      city: (a, b) => (a.city ?? '').localeCompare(b.city ?? '') || nameOf(a).localeCompare(nameOf(b)),
      type: (a, b) =>
        (prettyType(a) ?? '').localeCompare(prettyType(b) ?? '') || nameOf(a).localeCompare(nameOf(b)),
      level: (a, b) => (a.overall_average ?? -1) - (b.overall_average ?? -1),
      bites: (a, b) => a.rating_count - b.rating_count || nameOf(a).localeCompare(nameOf(b)),
      google: (a, b) => (a.google_rating ?? -1) - (b.google_rating ?? -1),
    };
    return filtered.sort((a, b) => cmp[sort.key](a, b) * sort.dir);
  }, [rows, search, bitesFilter, cityFilter, typeFilter, levelFilter, sort]);

  const hasFilters = !!search || !!bitesFilter || !!cityFilter || !!typeFilter || !!levelFilter;

  const clearFilters = () => {
    setSearch('');
    setBitesFilter('');
    setCityFilter('');
    setTypeFilter('');
    setLevelFilter('');
  };

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const rated = rows.filter((r) => r.rating_count > 0);
    const totalBites = rated.reduce((s, r) => s + r.rating_count, 0);
    const weighted = rated.reduce((s, r) => s + (r.overall_average ?? 0) * r.rating_count, 0);
    const cities = new Set(rows.map((r) => r.city).filter(Boolean)).size;
    return {
      total: rows.length,
      rated: rated.length,
      totalBites,
      avg: totalBites ? weighted / totalBites : null,
      cities,
    };
  }, [rows]);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'google_place_id', 'name', 'street_address', 'city', 'state', 'postal_code', 'type',
      'sound_bites', 'avg_level', 'google_rating', 'google_rating_count', 'website', 'phone', 'source',
    ];
    const lines = visible.map((r) =>
      [
        r.google_place_id, r.restaurant_name, r.street_address, r.city, r.state, r.postal_code,
        prettyType(r), r.rating_count, r.overall_average, r.google_rating, r.google_rating_count,
        r.google_website, r.google_phone_number, r.source,
      ]
        .map(esc)
        .join(','),
    );
    const blob = new Blob([[header.map(esc).join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `restaurants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const headerBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : -1 }))}
      className={`inline-flex items-center gap-1 ${sort.key === key ? 'text-gray-900' : ''}`}
    >
      {label}
      {sort.key === key && <span className="text-[10px]">{sort.dir === -1 ? '▼' : '▲'}</span>}
    </button>
  );

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold">Couldn't load restaurants</p>
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
    return <p className="py-24 text-center text-sm text-gray-400">Loading restaurants…</p>;
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile label="Restaurants" value={stats.total} sub={`across ${stats.cities} cities`} />
          <StatTile
            label="With Sound Bites"
            value={stats.rated}
            sub={`${Math.round((stats.rated / stats.total) * 100)}% of all`}
          />
          <StatTile
            label="Average level"
            value={stats.avg != null ? stats.avg.toFixed(1) : '—'}
            sub={`from ${stats.totalBites} bites`}
          />
          <StatTile label="Sound Bites" value={stats.totalBites} sub="total posted" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, city, address, type…"
          className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        <select
          value={bitesFilter}
          onChange={(e) => setBitesFilter(e.target.value as BitesFilter)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Any bite count</option>
          <option value="with">With Sound Bites</option>
          <option value="without">No Sound Bites yet</option>
          <option value="2">2+ bites</option>
          <option value="3">3+ bites</option>
          <option value="5">5+ bites</option>
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="max-w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="max-w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l.rating} value={l.rating}>
              {l.rating} · {l.word}
            </option>
          ))}
        </select>
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
            {visible.length} of {rows.length}
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
              <th className="px-4 py-3">{headerBtn('name', 'Restaurant')}</th>
              <th className="px-4 py-3">{headerBtn('city', 'City')}</th>
              <th className="px-4 py-3">{headerBtn('type', 'Type')}</th>
              <th className="px-4 py-3">{headerBtn('level', 'Sound level')}</th>
              <th className="px-4 py-3">{headerBtn('bites', 'Bites')}</th>
              <th className="px-4 py-3">{headerBtn('google', 'Google')}</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.google_place_id}
                onClick={() => setEditing(r)}
                className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
              >
                <td className="max-w-64 px-4 py-3">
                  <p className="truncate font-medium">
                    {r.restaurant_name ?? <span className="text-gray-400 italic">unnamed</span>}
                    {r.google_maps_uri && (
                      <a
                        href={r.google_maps_uri}
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
                  {r.street_address && (
                    <p className="truncate text-xs text-gray-400">{r.street_address}</p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {r.city ?? <span className="text-gray-300">—</span>}
                  {r.state && <span className="ml-1 text-xs text-gray-400">{r.state}</span>}
                </td>
                <td className="max-w-40 truncate px-4 py-3 text-gray-600">
                  {prettyType(r) ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.overall_average != null ? (
                    <span className="flex items-center gap-1.5">
                      <LevelBadge rating={Math.round(r.overall_average)} />
                      <span className="text-xs text-gray-500">{fmtAvg(r.overall_average)}</span>
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {r.rating_count > 0 ? (
                    r.rating_count
                  ) : (
                    <span className="font-normal text-gray-300">0</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {r.google_rating != null ? (
                    <>
                      {r.google_rating}★{' '}
                      <span className="text-xs text-gray-400">
                        ({(r.google_rating_count ?? 0).toLocaleString()})
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-2 py-3 text-gray-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-400">
                  No restaurants match{hasFilters ? ' the current filters' : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditRestaurantModal
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
