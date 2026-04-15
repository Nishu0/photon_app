export interface ZonedStamp {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

const weekdayMap: Record<string, string> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday"
};

export function stampInZone(when: Date, tz: string): ZonedStamp {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short"
  });

  const pieces = Object.fromEntries(fmt.formatToParts(when).map((piece) => [piece.type, piece.value]));
  return {
    year: Number(pieces.year),
    month: Number(pieces.month),
    day: Number(pieces.day),
    hour: Number(pieces.hour === "24" ? "0" : pieces.hour),
    minute: Number(pieces.minute),
    second: Number(pieces.second),
    weekday: weekdayMap[pieces.weekday ?? ""] ?? "unknown"
  };
}

export function localDayKey(when: Date, tz: string): string {
  const s = stampInZone(when, tz);
  return `${s.year}-${pad2(s.month)}-${pad2(s.day)}`;
}

export function humanStamp(when: Date, tz: string): string {
  const s = stampInZone(when, tz);
  return `${s.year}-${pad2(s.month)}-${pad2(s.day)} ${pad2(s.hour)}:${pad2(s.minute)} (${s.weekday})`;
}

export function nextOccurrenceOf(hhmm: string, tz: string, from = new Date()): Date {
  const [hour, minute] = parseHHMM(hhmm);
  const stamp = stampInZone(from, tz);
  const todayLocalMs = zonedToUtcMs(stamp.year, stamp.month, stamp.day, hour, minute, tz);
  if (todayLocalMs > from.getTime()) return new Date(todayLocalMs);

  const tomorrow = new Date(todayLocalMs + 24 * 60 * 60 * 1000);
  const tStamp = stampInZone(tomorrow, tz);
  return new Date(zonedToUtcMs(tStamp.year, tStamp.month, tStamp.day, hour, minute, tz));
}

export function parseHHMM(hhmm: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`bad time ${hhmm}`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error(`bad time ${hhmm}`);
  return [hour, minute];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function zonedToUtcMs(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offsetMs = guess - zonedEpoch(new Date(guess), tz, y, mo, d, h, mi);
  return guess + offsetMs;
}

function zonedEpoch(at: Date, tz: string, ty: number, tm: number, td: number, th: number, tmi: number): number {
  const s = stampInZone(at, tz);
  return Date.UTC(s.year, s.month - 1, s.day, s.hour, s.minute, s.second)
    - (Date.UTC(ty, tm - 1, td, th, tmi, 0) - Date.UTC(ty, tm - 1, td, th, tmi, 0));
}
