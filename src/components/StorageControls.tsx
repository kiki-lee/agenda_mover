import React from 'react';
import { Activity, DayConfig, Section } from '../models';
import { clearState, downloadJson, readFileAsText, exportActivitiesToCSV, importActivitiesFromCSV } from '@utils/storage';
import type { Injection } from '../models';

interface Props {
  sections: Section[];
  activities: Activity[];
  config: DayConfig;
  injections?: Injection[];
  onImport: (payload: { sections: Section[]; activities: Activity[]; config: DayConfig; injections?: Injection[] }) => void;
  onClear: () => void;
}

// Controls to export/import agenda as JSON and clear saved data.
// Export downloads a JSON snapshot; Import reads a file and passes parsed state upward.
const StorageControls: React.FC<Props> = ({ sections, activities, config, injections, onImport, onClear }) => {
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const onExport = () => {
    // Bundle a shareable JSON snapshot
    downloadJson('agenda-mover.json', { version: 2 as const, sections, activities, config, injections: injections ?? [] });
  };

  const onExportCSV = () => {
    const csv = exportActivitiesToCSV(activities, sections);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agenda-mover.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const onPickImport = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const isJson = file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{');
      if (isJson) {
        const parsed = JSON.parse(text);
        if (parsed && (parsed.version === 1 || parsed.version === 2) && parsed.sections && parsed.activities && parsed.config) {
          onImport({ sections: parsed.sections, activities: parsed.activities, config: parsed.config, injections: parsed.injections });
        } else {
          alert('Invalid JSON file.');
        }
      } else {
        // Assume CSV: sections + activities
        const res = importActivitiesFromCSV(text);
        if (res.activities.length) {
          onImport({ sections: res.sections, activities: res.activities, config });
        } else {
          alert('Invalid or empty CSV file.');
        }
      }
    } catch (err) {
      alert('Failed to import file.');
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const onClearAll = () => {
    clearState();
    onClear();
  };

  return (
    <fieldset className="panel">
      <legend>Data</legend>
      <div className="row">
        <button onClick={onExport}>Export JSON</button>
        <button onClick={onExportCSV}>Export CSV</button>
        <button onClick={onPickImport}>Import JSON/CSV</button>
        <button className="danger" onClick={onClearAll}>Clear Saved</button>
        <button onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set('print', '1');
          window.open(url.toString(), '_blank');
        }}>Print View</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,text/csv" onChange={onFileChange} style={{ display: 'none' }} />
    </fieldset>
  );
};

export default StorageControls;
