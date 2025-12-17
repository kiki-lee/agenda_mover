// Simple localStorage persistence and JSON import/export helpers
// These functions centralize state serialization for the Agenda Mover app.

import { Activity, DayConfig, Section, Injection, ID } from '../models';

export const STORAGE_KEY = 'agenda-mover/state/v1';
export const PREFS_KEY = 'agenda-mover/prefs/v2';

export type PersistedState =
  | {
      version: 1;
      sections: Section[];
      activities: Activity[];
      config: DayConfig;
    }
  | {
      version: 2;
      sections: Section[];
      activities: Activity[];
      config: DayConfig;
      injections: Injection[];
    };

// Save current state to localStorage
export function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save state', err);
  }
}

// Load state from localStorage, if present
export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.version === 1 || parsed.version === 2)) return parsed as PersistedState;
    return null;
  } catch (err) {
    console.warn('Failed to load state', err);
    return null;
  }
}

// Clear saved state
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// Preferences persistence (e.g., auto-apply setting)
export interface PreferencesV2 {
  version: 2;
  autoApplyOnceOnLoad?: boolean;
  hideCompleted?: boolean;
  collapsedSections?: Record<ID, boolean>;
  columnWidths?: {
    activity: number; owner: number; slide: number; duration: number;
    files: number; details: number; notes: number; starts: number; ends: number;
  };
}

export function savePrefs(prefs: PreferencesV2) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

export function loadPrefs(): PreferencesV2 | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 2) return parsed as PreferencesV2;
    return null;
  } catch {
    return null;
  }
}

// CSV helpers: Export activities table and sections mapping.
// Note: CSV does not carry computed injections; it captures activities and config minimally.
export function exportActivitiesToCSV(activities: Activity[], sections: Section[]): string {
  const sectionNameById = new Map(sections.map((s) => [s.id, s.name] as const));
  const header = ['Section','Title','Owner','SlideNumber','DurationMin','Files','Details','Notes'];
  const lines = [header.join(',')];
  for (const a of activities) {
    const row = [
      escapeCsv(sectionNameById.get(a.sectionId) ?? ''),
      escapeCsv(a.title),
      escapeCsv(a.owner),
      escapeCsv(a.slideNumber ?? ''),
      String(a.durationMin),
      escapeCsv(a.files ?? ''),
      escapeCsv(a.details ?? ''),
      escapeCsv(a.notes ?? ''),
    ];
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

function escapeCsv(val: string): string {
  const needsQuotes = /[",\n]/.test(val);
  let v = val.replace(/"/g, '""');
  return needsQuotes ? `"${v}"` : v;
}

export interface CsvImportResult {
  sections: Section[];
  activities: Activity[];
}

// Import activities and sections from CSV. Unknown sections will be created.
export function importActivitiesFromCSV(text: string): CsvImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return { sections: [], activities: [] };
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = {
    section: header.indexOf('section'),
    title: header.indexOf('title'),
    owner: header.indexOf('owner'),
    slide: header.indexOf('slidenumber'),
    duration: header.indexOf('durationmin'),
    files: header.indexOf('files'),
    details: header.indexOf('details'),
    notes: header.indexOf('notes'),
  };
  const sectionsMap = new Map<string, Section>();
  const makeId = () => Math.random().toString(36).slice(2, 9);
  const activities: Activity[] = [];
  let orderCounter = 1;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const secName = (cols[idx.section] ?? '').trim() || 'Imported';
    if (!sectionsMap.has(secName)) {
      sectionsMap.set(secName, { id: makeId(), name: secName, order: orderCounter++ });
    }
    const sectionId = sectionsMap.get(secName)!.id;
    activities.push({
      id: makeId(),
      title: (cols[idx.title] ?? '').trim(),
      owner: (cols[idx.owner] ?? '').trim(),
      slideNumber: (cols[idx.slide] ?? '').trim() || undefined,
      durationMin: Number((cols[idx.duration] ?? '0').trim()) || 0,
      files: (cols[idx.files] ?? '').trim() || undefined,
      details: (cols[idx.details] ?? '').trim() || undefined,
      notes: (cols[idx.notes] ?? '').trim() || undefined,
      sectionId,
    });
  }

  return { sections: Array.from(sectionsMap.values()), activities };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cur += ch;
    } else {
      if (ch === '"') { inQuotes = true; continue; }
      if (ch === ',') { result.push(cur); cur = ''; continue; }
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// Trigger a JSON file download for the given state object
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Read file contents as text (used for JSON import)
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}
