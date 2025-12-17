// Time helpers: parse and format times as minutes since midnight

// Parse a time string like "08:30" or "8:30" into minutes from midnight
export function parseTimeToMin(value: string): number | null {
  // Accept HH:MM 24-hour inputs (from <input type="time">)
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Format minutes from midnight to a human-friendly time like "8:30 AM"
export function formatMin(min: number): string {
  let m = Math.max(0, min);
  const h24 = Math.floor(m / 60) % 24;
  const minutes = m % 60;
  const am = h24 < 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutes.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

// Clamp a number between min and max
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Format minutes from midnight to 24h HH:mm (for input[type=time])
export function formatMin24(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const minutes = min % 60;
  return `${h24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
