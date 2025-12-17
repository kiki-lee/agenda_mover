import React from 'react';
import { ID, Section } from '../models';

interface Props {
  sections: Section[];
  onAdd: (name: string) => void;
  onRename: (id: ID, name: string) => void;
  onRemove: (id: ID) => void;
  onMoveUp?: (id: ID) => void;
  onMoveDown?: (id: ID) => void;
  onSetDay?: (id: ID, dayNumber: number) => void;
}

// Simple section manager: add, rename, and remove sections.
const SectionManager: React.FC<Props> = ({ sections, onAdd, onRename, onRemove, onMoveUp, onMoveDown, onSetDay }) => {
  const [name, setName] = React.useState('');

  return (
    <fieldset className="panel">
      <legend>Sections</legend>
      <div className="row">
        <input
          type="text"
          placeholder="New section name (e.g., Day 1: Morning)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={() => {
            if (name.trim()) {
              onAdd(name.trim());
              setName('');
            }
          }}
        >
          Add Section
        </button>
      </div>

      <ul className="section-list">
        {sections
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => (
            <li key={s.id} className="section-item">
              {/* Day selector before name, compact and unlabeled */}
              <select
                value={s.dayNumber ?? 1}
                onChange={(e) => onSetDay && onSetDay(s.id, Number(e.target.value))}
                style={{ width: 56, marginRight: 6 }}
                title="Day"
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <input
                className="inline"
                value={s.name}
                onChange={(e) => onRename(s.id, e.target.value)}
              />
              {onMoveUp && <button onClick={() => onMoveUp(s.id)} title="Move up">↑</button>}
              {onMoveDown && <button onClick={() => onMoveDown(s.id)} title="Move down">↓</button>}
              <button className="danger" onClick={() => onRemove(s.id)} title="Remove" aria-label="Remove" style={{ width: 32 }}>
                🗑️
              </button>
            </li>
          ))}
      </ul>
    </fieldset>
  );
};

export default SectionManager;
