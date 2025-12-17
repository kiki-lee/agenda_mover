import React from 'react';
import { ComputedRow, Section } from '../models';
import { formatMin } from '@utils/time';

interface Props {
  sections: Section[];
  computed: ComputedRow[];
}

// Print-friendly, read-only view of the agenda.
// Renders a compact, monochrome table grouped by section, suitable for paper or PDF export.
const PrintView: React.FC<Props> = ({ sections, computed }) => {
  React.useEffect(() => {
    // Slight delay to ensure layout is painted before opening print dialog
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);

  const orderedSections = sections.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="print-container">
      <header className="print-header">
        <h1>Agenda</h1>
      </header>

      {orderedSections.map((section) => (
        <section key={section.id} className={`print-section day-${section.dayNumber ?? 1}`}>
          <h2 className="print-section-title">{section.name}</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Time (Start - End)</th>
                <th style={{ width: 70 }}>Slides</th>
                <th style={{ width: 220 }}>Item</th>
                <th style={{ width: 220 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {computed
                .filter((r) => r.sectionId === section.id)
                .map((row) => {
                  if (row.type === 'activity') {
                    const a = row.activity;
                    return (
                      <tr key={row.id}>
                        <td>{formatMin(row.startMin)} - {formatMin(row.endMin)}</td>
                        <td>{a.slideNumber ?? ''}</td>
                        <td>
                          <div className="print-title">{a.title}</div>
                          <div className="print-sub">
                            {[a.owner ? `Owner: ${a.owner}` : '', `${a.durationMin} min`].filter(Boolean).join(' — ')}
                          </div>
                        </td>
                        <td>{[a.details, a.notes].filter(Boolean).join(' — ')}</td>
                      </tr>
                    );
                  }

                  // Break / Lunch / Overflow rows
                  return (
                    <tr key={row.id} className={`print-computed ${row.type}`}>
                      <td>{formatMin(row.startMin)} - {formatMin(row.endMin)}</td>
                      <td colSpan={3}>
                        <strong>{row.type === 'lunch' ? 'Lunch' : row.type === 'break' ? 'Break' : row.label}</strong>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
};

export default PrintView;
