import React from 'react';
import type { DayConfig as DayCfg } from '../models';
import { parseTimeToMin, formatMin24 } from '@utils/time';

interface Props {
  value: DayCfg;
  onChange: (next: DayCfg) => void;
  onApply?: () => void; // triggers recomputation of breaks/lunch
  isDirty?: boolean; // indicates config changes not yet applied
  autoApplyEnabled?: boolean; // if true, will auto-apply once
  onToggleAutoApply?: (enabled: boolean) => void;
  onClearInjections?: () => void;
}

// Day configuration panel for start/end times, breaks, and lunch.
// Uses native inputs where possible for easy editing.
const DayConfig: React.FC<Props> = ({ value, onChange, onApply, isDirty, autoApplyEnabled, onToggleAutoApply, onClearInjections }) => {
  // Helper to update a numeric field
  const set = (patch: Partial<DayCfg>) => onChange({ ...value, ...patch });

  return (
    <fieldset className="panel">
      <legend>Day Configuration</legend>
      <div className="grid-2">
        <label>
          Number of Days
          <input
            type="number"
            min={1}
            step={1}
            value={value.numberOfDays ?? 1}
            onChange={(e) => set({ numberOfDays: Math.max(1, Number(e.target.value || 1)) })}
          />
        </label>
      </div>
      <div className="grid-2">
        <label>
          Start Time
          <input
            type="time"
            value={formatMin24(value.dayStartMin)}
            onChange={(e) => {
              const v = parseTimeToMin(e.target.value);
              if (v != null) set({ dayStartMin: v });
            }}
          />
        </label>
        <label>
          End Time
          <input
            type="time"
            value={formatMin24(value.dayEndMin)}
            onChange={(e) => {
              const v = parseTimeToMin(e.target.value);
              if (v != null) set({ dayEndMin: v });
            }}
          />
        </label>
      </div>

      <div className="grid-2">
        <label>
          Break Interval (min)
          <input
            type="number"
            min={15}
            step={5}
            placeholder="90"
            onChange={(e) => set({ breakIntervalMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
        <label>
          Break Duration (min)
          <input
            type="number"
            min={5}
            step={5}
            placeholder="15"
            onChange={(e) => set({ breakDurationMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
      </div>

      <div className="grid-2">
        <label>
          Lunch Around
          <input
            type="time"
            value={value.lunchTargetMin != null ? formatMin24(value.lunchTargetMin) : ''}
            onChange={(e) => {
              const v = parseTimeToMin(e.target.value);
              set({ lunchTargetMin: v ?? undefined });
            }}
          />
        </label>
        <label>
          Lunch Duration (min)
          <input
            type="number"
            min={15}
            step={5}
            placeholder="60"
            onChange={(e) => set({ lunchDurationMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
      </div>
      <div className="row" style={{ marginTop: 8, alignItems: 'center', gap: 8 }}>
        <button onClick={onApply}>Update</button>
        {isDirty ? <span style={{ color: '#a16207' }} title="Changes not yet applied">• Pending changes</span> : <span style={{ color: '#6b7280' }}>Up to date</span>}
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={!!autoApplyEnabled} onChange={(e) => onToggleAutoApply?.(e.target.checked)} />
          Auto-apply once after load
        </label>
        <button className="danger" onClick={onClearInjections}>Clear breaks/lunch</button>
      </div>
    </fieldset>
  );
};

export default DayConfig;
