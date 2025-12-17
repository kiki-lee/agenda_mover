import React from 'react';
import DayConfig from './components/DayConfig';
import SectionManager from './components/SectionManager';
import StorageControls from './components/StorageControls';
import AgendaTable from './components/AgendaTable';
import PrintView from './components/PrintView';
import { Activity, DayConfig as DayCfg, ID, Section } from './models';
import { buildScheduleFromActivities } from './utils/schedule';
import { loadState, saveState, loadPrefs, savePrefs } from './utils/storage';
import type { Injection } from './models';

// Simple id helper for demo purposes
const uid = () => Math.random().toString(36).slice(2, 9);

const App: React.FC = () => {
  // App state: sections, activities, and day configuration
  const [sections, setSections] = React.useState<Section[]>([
    { id: uid(), name: 'Day 1: Morning', order: 1 },
    { id: uid(), name: 'Day 1: Afternoon', order: 2 },
  ]);

  const [activities, setActivities] = React.useState<Activity[]>([
    // Sample activities if no saved state exists
    {
      id: uid(),
      title: 'Welcome + Introductions',
      owner: 'Host',
      slideNumber: '1-3',
      durationMin: 20,
      files: '',
      details: '',
      notes: '',
      sectionId: '' as unknown as ID, // assigned after sections load
    },
    {
      id: uid(),
      title: 'Keynote',
      owner: 'Speaker A',
      slideNumber: '4-15',
      durationMin: 45,
      files: '',
      details: '',
      notes: '',
      sectionId: '' as unknown as ID,
    },
  ]);

  // On first mount: try to load saved state; otherwise assign default section ids
  React.useEffect(() => {
    const saved = loadState();
    if (saved) {
      setSections(saved.sections);
      setActivities(saved.activities);
      setConfig(saved.config);
      if ('injections' in saved && saved.injections) setInjections(saved.injections as Injection[]);
    } else {
      setActivities((prev) => prev.map((a, i) => ({ ...a, sectionId: sections[i % sections.length].id })));
    }
    const prefs = loadPrefs();
    if (prefs) {
      if (prefs.autoApplyOnceOnLoad) setAutoApplyEnabled(true);
      if (typeof prefs.hideCompleted === 'boolean') setHideCompleted(prefs.hideCompleted);
      if (prefs.collapsedSections) setCollapsedSections(prefs.collapsedSections);
      if ((prefs as any).columnWidths) setColumnWidths((prefs as any).columnWidths);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [config, setConfig] = React.useState<DayCfg>({
    dayStartMin: 9 * 60, // 9:00 AM
    dayEndMin: 16 * 60, // 4:00 PM
    numberOfDays: 1,
    breakIntervalMin: 90, // ~90 min
    breakDurationMin: 15, // 15 min
    lunchTargetMin: 12 * 60, // 12:00 PM
    lunchDurationMin: 60, // 60 min
  });

  // Injections legacy (kept empty now that breaks/lunch become real activities)
  const [injections, setInjections] = React.useState<Injection[]>([]);
  const [lastAppliedConfig, setLastAppliedConfig] = React.useState<DayCfg | null>(null);
  const [autoApplyEnabled, setAutoApplyEnabled] = React.useState<boolean>(false);
  const [hideCompleted, setHideCompleted] = React.useState<boolean>(false);
  const [collapsedSections, setCollapsedSections] = React.useState<Record<ID, boolean>>({});
  const [columnWidths, setColumnWidths] = React.useState<{ activity: number; owner: number; slide: number; duration: number; files: number; details: number; notes: number; starts: number; ends: number }>({ activity: 28, owner: 12, slide: 10, duration: 10, files: 12, details: 14, notes: 16, starts: 9, ends: 9 });

  // Derived: computed schedule rows using explicit injections. Only day start/end auto-impact times.
  const computed = React.useMemo(
    () => buildScheduleFromActivities({ dayStartMin: config.dayStartMin, dayEndMin: config.dayEndMin, numberOfDays: config.numberOfDays }, sections, activities),
    [config.dayStartMin, config.dayEndMin, config.numberOfDays, sections, activities],
  );

  // When ?print=1 is present in the URL, render the print-friendly read-only view
  const printMode = React.useMemo(() => new URL(window.location.href).searchParams.get('print') === '1', []);
  if (printMode) {
    return <PrintView sections={sections} computed={computed} />;
  }

  // Persist state when core data changes
  React.useEffect(() => {
    saveState({ version: 2, sections, activities, config, injections });
  }, [sections, activities, config, injections]);

  React.useEffect(() => {
    savePrefs({ version: 2, autoApplyOnceOnLoad: autoApplyEnabled, hideCompleted, collapsedSections, columnWidths });
  }, [autoApplyEnabled, hideCompleted, collapsedSections, columnWidths]);

  // Simple Undo stack and keyboard handler
  type Snapshot = { sections: Section[]; activities: Activity[]; config: DayCfg; collapsedSections: Record<ID, boolean>; hideCompleted: boolean; columnWidths: typeof columnWidths };
  const [history, setHistory] = React.useState<Snapshot[]>([]);
  const pushHistory = React.useCallback(() => {
    setHistory((prev) => [...prev.slice(-49), { sections: JSON.parse(JSON.stringify(sections)), activities: JSON.parse(JSON.stringify(activities)), config: JSON.parse(JSON.stringify(config)), collapsedSections: JSON.parse(JSON.stringify(collapsedSections)), hideCompleted, columnWidths: JSON.parse(JSON.stringify(columnWidths)) }]);
  }, [sections, activities, config, collapsedSections, hideCompleted, columnWidths]);
  const undo = React.useCallback(() => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setSections(last.sections);
      setActivities(last.activities);
      setConfig(last.config);
      setCollapsedSections(last.collapsedSections);
      setHideCompleted(last.hideCompleted);
      setColumnWidths(last.columnWidths);
      return prev.slice(0, -1);
    });
  }, []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
      if (isUndo) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // Section operations
  const addSection = (name: string) => {
    pushHistory();
    setSections((prev) => {
      const order = prev.length ? Math.max(...prev.map((s) => s.order)) + 1 : 1;
      return [...prev, { id: uid(), name, order }];
    });
  };

  const renameSection = (id: ID, name: string) => {
    pushHistory();
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const removeSection = (id: ID) => {
    pushHistory();
    setSections((prev) => prev.filter((s) => s.id !== id));
    setActivities((prev) => prev.filter((a) => a.sectionId !== id));
  };

  const moveSectionUp = (id: ID) => {
    pushHistory();
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const a = sorted[idx - 1];
      const b = sorted[idx];
      const next = prev.map((s) =>
        s.id === a.id ? { ...s, order: b.order } : s.id === b.id ? { ...s, order: a.order } : s,
      );
      return next;
    });
  };

  const moveSectionDown = (id: ID) => {
    pushHistory();
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const a = sorted[idx];
      const b = sorted[idx + 1];
      const next = prev.map((s) =>
        s.id === a.id ? { ...s, order: b.order } : s.id === b.id ? { ...s, order: a.order } : s,
      );
      return next;
    });
  };

  const setSectionDay = (id: ID, dayNumber: number) => {
    pushHistory();
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, dayNumber } : s)));
  };

  // Activity operations
  const addActivity = (sectionId: ID) => {
    pushHistory();
    setActivities((prev) => [
      ...prev,
      {
        id: uid(),
        title: 'New activity',
        owner: '',
        slideNumber: '',
        durationMin: 15,
        files: '',
        details: '',
        notes: '',
        sectionId,
      },
    ]);
  };

  const updateActivity = (next: Activity) => {
    setActivities((prev) => prev.map((a) => (a.id === next.id ? next : a)));
  };
  const commitActivityChange = () => {
    pushHistory();
  };

  const removeActivity = (id: ID) => {
    pushHistory();
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };
  // Update considers existing breaks/lunch and proposes minimal insertions/updates with confirmation
  const applyConfig = () => {
    // Respect user's current items. Do not auto-insert or modify.
    // Only set lastAppliedConfig and optionally note if breaks/lunch are missing.
    setLastAppliedConfig({ ...config });
  };

  // Auto-apply once after initial load if enabled
  React.useEffect(() => {
    if (autoApplyEnabled && !lastAppliedConfig) {
      applyConfig();
      setAutoApplyEnabled(false); // apply once, then revert to manual
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApplyEnabled]);

  const clearInjections = () => setInjections([]);

  const configIsDirty = React.useMemo(() => {
    if (!lastAppliedConfig) return true; // nothing applied yet
    const a = lastAppliedConfig;
    const b = config;
    return (
      a.dayStartMin !== b.dayStartMin ||
      a.dayEndMin !== b.dayEndMin ||
      a.breakIntervalMin !== b.breakIntervalMin ||
      a.breakDurationMin !== b.breakDurationMin ||
      a.lunchTargetMin !== b.lunchTargetMin ||
      a.lunchDurationMin !== b.lunchDurationMin
    );
  }, [lastAppliedConfig, config]);

  // Drag-and-drop reorder handler
  const reorder = (id: ID, overId: ID | null, overSectionId: ID | null) => {
    pushHistory();
    setActivities((prev) => {
      const fromIdx = prev.findIndex((a) => a.id === id);
      if (fromIdx < 0) return prev;
      const moving = prev[fromIdx];

      // Target index: if overId is null, move to end of overSection; otherwise before overId
      let targetSection = overSectionId ?? moving.sectionId;
      let targetIdx = prev.length;

      if (overId) {
        const overIdx = prev.findIndex((a) => a.id === overId);
        if (overIdx >= 0) {
          targetIdx = overIdx;
          targetSection = prev[overIdx].sectionId;
        }
      } else if (targetSection) {
        // move to end of the target section
        const indicesInSection = prev
          .map((a, i) => ({ a, i }))
          .filter((x) => x.a.sectionId === targetSection)
          .map((x) => x.i);
        targetIdx = indicesInSection.length ? indicesInSection[indicesInSection.length - 1] + 1 : prev.length;
      }

      const next = prev.slice();
      // Remove from old position
      next.splice(fromIdx, 1);
      // Insert at new position with updated sectionId
      const updated = { ...moving, sectionId: targetSection } as Activity;
      next.splice(targetIdx > fromIdx ? targetIdx - 1 : targetIdx, 0, updated);
      return next;
    });
  };

  return (
    <div className="app">
      <header>
        <h1>Agenda Mover</h1>
      </header>
      {/* Removed auto-apply banner to avoid intrusive changes */}

      <div className="layout">
        <div className="sidebar">
          <DayConfig
            value={config}
            onChange={setConfig}
            onApply={applyConfig}
            isDirty={configIsDirty}
            autoApplyEnabled={autoApplyEnabled}
            onToggleAutoApply={setAutoApplyEnabled}
            onClearInjections={clearInjections}
          />
          <SectionManager
            sections={sections}
            onAdd={addSection}
            onRename={renameSection}
            onRemove={removeSection}
            onMoveUp={moveSectionUp}
            onMoveDown={moveSectionDown}
            onSetDay={setSectionDay}
          />
          <div className="panel">
            <div className="row">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
                Hide Completed
              </label>
            </div>
          </div>
          <StorageControls
            sections={sections}
            activities={activities}
            config={config}
            injections={injections}
            onImport={({ sections: s, activities: a, config: c }) => {
              setSections(s);
              setActivities(a);
              setConfig(c);
              // Imported files may include injections (v2). If not, clear to require Update.
              // @ts-expect-error tolerate v1 imports without injections
              setInjections(arguments[0]?.injections ?? []);
            }}
            onClear={() => {
              const morning: Section = { id: uid(), name: 'Day 1: Morning', order: 1 };
              const afternoon: Section = { id: uid(), name: 'Day 1: Afternoon', order: 2 };
              setSections([morning, afternoon]);
              setActivities([]);
              setConfig({
                dayStartMin: 8 * 60 + 30,
                dayEndMin: 17 * 60,
                breakIntervalMin: 90,
                breakDurationMin: 10,
                lunchTargetMin: 12 * 60,
                lunchDurationMin: 45,
              });
              setInjections([]);
              setLastAppliedConfig(null);
              setAutoApplyEnabled(false);
            }}
          />
        </div>
        <main>
          <AgendaTable
            sections={sections}
            computed={computed}
            activities={activities}
            onActivityChange={updateActivity}
            onCommitActivityChange={commitActivityChange}
            onAddActivity={addActivity}
            onRemoveActivity={removeActivity}
            onReorder={reorder}
            hideCompleted={hideCompleted}
            collapsed={collapsedSections}
            onToggleCollapse={(id) => setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }))}
            dayEndMin={config.dayEndMin}
            columnWidths={columnWidths}
            onColumnWidthsChange={setColumnWidths}
          />
        </main>
      </div>
    </div>
  );
};

export default App;
