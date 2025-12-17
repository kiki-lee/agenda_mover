import React from 'react';
import { Activity, ComputedRow, ID, Section } from '../models';
import { formatMin } from '@utils/time';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef } from 'react';

interface TableProps {
  sections: Section[];
  computed: ComputedRow[];
  activities: Activity[];
  onActivityChange: (next: Activity) => void;
  onCommitActivityChange?: () => void;
  onAddActivity: (sectionId: ID) => void;
  onRemoveActivity: (id: ID) => void;
  onReorder: (id: ID, overId: ID | null, overSectionId: ID | null) => void;
  hideCompleted?: boolean;
  collapsed?: Record<ID, boolean>;
  onToggleCollapse?: (sectionId: ID) => void;
  dayEndMin?: number;
  columnWidths?: { activity: number; owner: number; slide: number; duration: number; files: number; details: number; notes: number; starts: number; ends: number };
  onColumnWidthsChange?: (next: { activity: number; owner: number; slide: number; duration: number; files: number; details: number; notes: number; starts: number; ends: number }) => void;
}

// Row component for sortable activities (computed rows are not draggable)
const SortableActivityRow: React.FC<{
  activity: Activity;
  startMin: number;
  endMin: number;
  onChange: (a: Activity) => void;
  onRemove: (id: ID) => void;
  overtime?: boolean;
  onCommit?: () => void;
}> = ({ activity, startMin, endMin, onChange, onRemove, overtime, onCommit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: activity.completed ? '#f0f2f5' : 'white',
    color: activity.completed ? '#555555' : undefined,
  };

  return (
    <tr ref={setNodeRef} className={`${activity.completed ? 'completed' : ''} ${overtime ? 'overtime' : ''}`.trim()} style={style} {...attributes}>
      <td className="drag" {...listeners} title="Drag to reorder">⋮⋮</td>
      <td>
        <input
          className="inline"
          value={activity.title}
          onChange={(e) => onChange({ ...activity, title: e.target.value })}
          onBlur={onCommit}
        />
      </td>
      <td>
        <input
          className="inline"
          value={activity.owner}
          onChange={(e) => onChange({ ...activity, owner: e.target.value })}
          onBlur={onCommit}
        />
      </td>
      <td>
        <input
          className="inline"
          value={activity.slideNumber ?? ''}
          onChange={(e) => onChange({ ...activity, slideNumber: e.target.value })}
          onBlur={onCommit}
        />
      </td>
      <td>
        <input
          className="inline"
          type="number"
          min={1}
          value={activity.durationMin}
          onChange={(e) => onChange({ ...activity, durationMin: Number(e.target.value || 0) })}
          onBlur={onCommit}
        />
      </td>
      <td>
        <input
          className="inline"
          value={activity.files ?? ''}
          onChange={(e) => onChange({ ...activity, files: e.target.value })}
          onBlur={onCommit}
        />
      </td>
      <td>
        <input
          className="inline"
          value={activity.details ?? ''}
          onChange={(e) => onChange({ ...activity, details: e.target.value })}
          onBlur={onCommit}
        />
      </td>
      <td>
        <input
          className="inline"
          value={activity.notes ?? ''}
          onChange={(e) => onChange({ ...activity, notes: e.target.value })}
          onBlur={onCommit}
        />
      </td>
      <td className="time">{formatMin(startMin)}</td>
      <td className="time">{formatMin(endMin)}</td>
      <td>
        <label title="Completed" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={!!activity.completed}
            onChange={(e) => onChange({ ...activity, completed: e.target.checked })}
            aria-label="Completed"
          />
        </label>
        <button className="danger" onClick={() => onRemove(activity.id)} title="Delete" aria-label="Delete" style={{ marginLeft: 8 }}>
          🗑️
        </button>
      </td>
    </tr>
  );
};

const ComputedRowView: React.FC<{ row: ComputedRow }> = ({ row }) => {
  if (row.type === 'activity') return null;
  return (
    <tr className={`computed ${row.type}`}>
      <td colSpan={8}>
        <strong>{row.type === 'lunch' ? 'Lunch' : row.type === 'break' ? 'Break' : row.label}</strong>
      </td>
      <td className="time">{formatMin(row.startMin)}</td>
      <td className="time">{formatMin(row.endMin)}</td>
      <td></td>
    </tr>
  );
};

const AgendaTable: React.FC<TableProps> = ({
  sections,
  computed,
  activities,
  onActivityChange,
  onCommitActivityChange,
  onAddActivity,
  onRemoveActivity,
  onReorder,
  hideCompleted,
  collapsed,
  onToggleCollapse,
  dayEndMin,
  columnWidths,
  onColumnWidthsChange,
}) => {
  const tableRefs = useRef<Record<ID, HTMLTableElement | null>>({} as any);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor),
    useSensor(PointerSensor),
  );

  // Helper to list activity ids per section for SortableContext
  const idsBySection = new Map<ID, ID[]>();
  for (const s of sections) idsBySection.set(s.id, []);
  for (const a of activities) idsBySection.get(a.sectionId)?.push(a.id);

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = e.active.id as ID;
    const overId = (e.over?.id as ID) ?? null;
    // Determine drop section via droppable data (for empty-area drops) or over-row section
    const overSectionId = (e.over?.data?.current as any)?.sectionId ?? null;
    onReorder(activeId, overId, overSectionId);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <SectionDroppable key={section.id} sectionId={section.id}>
            <div className={`section day-${section.dayNumber ?? 1}`}>
            <div className="section-header">
              <button
                className={`toggle ${collapsed?.[section.id] ? 'collapsed' : 'expanded'}`}
                onClick={() => onToggleCollapse && onToggleCollapse(section.id)}
                title={collapsed?.[section.id] ? 'Expand' : 'Collapse'}
                aria-label={collapsed?.[section.id] ? 'Expand section' : 'Collapse section'}
              >
                ▶
              </button>
              <h3 style={{ flex: 1, marginLeft: 6 }}>{section.name}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => onAddActivity(section.id)}>Add activity</button>
              </div>
            </div>
            {!collapsed?.[section.id] && (
            <table className="agenda" ref={(el) => (tableRefs.current[section.id] = el)}>
              {columnWidths && (
                <colgroup>
                  <col style={{ width: '28px' }} />
                  <col style={{ width: `${columnWidths.activity}%` }} />
                  <col style={{ width: `${columnWidths.owner}%` }} />
                  <col style={{ width: `${columnWidths.slide}%` }} />
                  <col style={{ width: `${columnWidths.duration}%` }} />
                  <col style={{ width: `${columnWidths.files}%` }} />
                  <col style={{ width: `${columnWidths.details}%` }} />
                  <col style={{ width: `${columnWidths.notes}%` }} />
                  <col style={{ width: `${columnWidths.starts}%` }} />
                  <col style={{ width: `${columnWidths.ends}%` }} />
                  <col style={{ width: '90px' }} />
                </colgroup>
              )}
              <thead>
                <tr>
                  <th></th>
                  <th className="resizable">
                    Activity
                    <span className="col-resizer" onMouseDown={(e) => startResize(e, 'activity')}></span>
                  </th>
                  <th className="resizable">
                    Owner
                    <span className="col-resizer" onMouseDown={(e) => startResize(e, 'owner')}></span>
                  </th>
                  <th className="resizable">
                    Slide #
                    <span className="col-resizer" onMouseDown={(e) => startResize(e, 'slide')}></span>
                  </th>
                  <th className="resizable">
                    Duration (min)
                    <span className="col-resizer" onMouseDown={(e) => startResize(e, 'duration')}></span>
                  </th>
                  <th className="resizable">Files<span className="col-resizer" onMouseDown={(e) => startResize(e, 'files')}></span></th>
                  <th className="resizable">Details<span className="col-resizer" onMouseDown={(e) => startResize(e, 'details')}></span></th>
                  <th className="resizable">Notes<span className="col-resizer" onMouseDown={(e) => startResize(e, 'notes')}></span></th>
                  <th className="resizable">Starts<span className="col-resizer" onMouseDown={(e) => startResize(e, 'starts')}></span></th>
                  <th className="resizable">Ends<span className="col-resizer" onMouseDown={(e) => startResize(e, 'ends')}></span></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {/* Computed rows + activities for this section in interleaved order */}
                <SortableContext items={idsBySection.get(section.id) ?? []} strategy={verticalListSortingStrategy}>
                  {computed
                    .filter((r) => r.sectionId === section.id || (r.type !== 'activity' && r.sectionId === section.id))
                    .map((row) => (
                      row.type === 'activity' ? (
                        hideCompleted && row.activity.completed ? null : (
                        <SortableActivityRow
                          key={row.id}
                          activity={row.activity}
                          startMin={row.startMin}
                          endMin={row.endMin}
                          onChange={onActivityChange}
                          onRemove={onRemoveActivity}
                          overtime={typeof dayEndMin === 'number' ? row.endMin > dayEndMin! : false}
                          onCommit={onCommitActivityChange}
                        />
                        )
                      ) : (
                        <ComputedRowView key={row.id} row={row} />
                      )
                    ))}
                </SortableContext>
              </tbody>
            </table>
            )}
            </div>
          </SectionDroppable>
        ))}
      <DragOverlay />
    </DndContext>
  );
};

export default AgendaTable;

// Droppable wrapper to allow dropping into an empty section area
const SectionDroppable: React.FC<{ sectionId: ID; children: React.ReactNode }> = ({ sectionId, children }) => {
  // Register a droppable area with sectionId in data so onDragEnd can resolve target section
  const { setNodeRef } = useDroppable({ id: `drop-${sectionId}`, data: { sectionId } });
  return (
    <div ref={setNodeRef} data-section-id={sectionId}>
      {children}
    </div>
  );
};

// Column resize helpers
type ResizableKey = 'activity' | 'owner' | 'slide' | 'duration' | 'files' | 'details' | 'notes' | 'starts' | 'ends';
function startResize(e: React.MouseEvent<HTMLSpanElement>, key: ResizableKey) {
  const th = (e.currentTarget.parentElement as HTMLTableCellElement);
  const table = th?.closest('table') as HTMLTableElement | null;
  if (!table) return;
  const tableWidth = table.clientWidth;
  const startX = e.clientX;
  const startWidth = th.clientWidth;
  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX;
    const newPx = Math.max(60, startWidth + delta);
    const pct = Math.min(60, Math.max(5, Math.round((newPx / tableWidth) * 100)));
    // Update inline width style directly for responsiveness
    const indexMap: Record<ResizableKey, number> = { activity: 1, owner: 2, slide: 3, duration: 4, files: 5, details: 6, notes: 7, starts: 8, ends: 9 };
    const idx = indexMap[key];
    const colgroup = table.querySelector('colgroup');
    const cols = colgroup?.querySelectorAll('col');
    const target = cols?.[idx];
    if (target) (target as HTMLElement).style.width = `${pct}%`;
    // Bubble up through a custom event so parent can persist
    const detail = { key, value: pct } as const;
    th.dispatchEvent(new CustomEvent('col-resize', { detail, bubbles: true }));
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
