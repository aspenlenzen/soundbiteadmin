// Ratings store a UTC timestamptz plus the IANA timezone the phone was in when
// the bite was posted. Display and editing both happen in that original zone so
// "7:15 PM at the restaurant" stays 7:15 PM no matter where the dashboard runs.

const safeTz = (tz: string | null | undefined): string | undefined => {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
};

export function formatInTz(
  iso: string | null | undefined,
  tz: string | null | undefined,
  opts: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: safeTz(tz) }).format(d);
}

type WallParts = { year: number; month: number; day: number; hour: number; minute: number };

function wallPartsInTz(d: Date, tz: string | undefined): WallParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

// Value for <input type="datetime-local">: the wall-clock time in the rating's zone.
export function toDatetimeLocal(iso: string | null | undefined, tz: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const w = wallPartsInTz(d, safeTz(tz));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

// What the zone's wall clock reads minus UTC, at the given instant.
function tzOffsetMs(tz: string, at: Date): number {
  const w = wallPartsInTz(at, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const atMinutes = Math.floor(at.getTime() / 60000) * 60000;
  return asUtc - atMinutes;
}

// Inverse of toDatetimeLocal: a datetime-local value entered in the rating's
// zone, back to a UTC ISO string. Two offset probes converge across DST edges.
export function fromDatetimeLocal(value: string, tz: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const wallMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const zone = safeTz(tz);
  if (!zone) {
    // No stored zone: treat input as the browser's local time.
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString();
  }
  let t = wallMs - tzOffsetMs(zone, new Date(wallMs));
  t = wallMs - tzOffsetMs(zone, new Date(t));
  return new Date(t).toISOString();
}
