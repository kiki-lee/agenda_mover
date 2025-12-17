import { Activity, ComputedActivityRow, ComputedBreakRow, ComputedOverflowRow, ComputedRow, DayConfig, ID, Section, Injection } from '../models';

// Compute a flat, ordered sequence of rows (activities with auto-inserted breaks/lunch),
// and map rows to their display section. Break/lunch rows are computed only (not draggable).
//
// Basic algorithm:
// - Walk all activities in section order, maintaining a "clock" and time since last break.
// - Insert a Break before an activity if the next activity would push past the break interval.
// - Insert Lunch once, near the target time, before an activity that crosses that time.
// - Generate an overflow marker if we pass dayEnd.
export function computeSchedule(
  config: DayConfig,
  sections: Section[],
  activities: Activity[],
): ComputedRow[] {
  const orderedSections = [...sections].sort((a, b) => a.order - b.order);
  const activitiesBySection = new Map<ID, Activity[]>(
    orderedSections.map((s) => [s.id, []]),
  );
  // Group activities by section in their existing order
  for (const a of activities) {
    const list = activitiesBySection.get(a.sectionId);
    if (list) list.push(a);
  }

  const rows: ComputedRow[] = [];
  let clock = config.dayStartMin; // current pointer in minutes
  let minutesSinceBreak = 0;
  let lunchInserted = false;

  // Helper to push a break row
  const pushBreak = (label: string, sectionId: ID | null, durationMin: number) => {
    const startMin = clock;
    const endMin = clock + durationMin;
    const row: ComputedBreakRow = {
      id: `${label}-${startMin}`,
      type: label.toLowerCase() === 'lunch' ? 'lunch' : 'break',
      sectionId,
      startMin,
      endMin,
      computed: true,
      label,
    };
    rows.push(row);
    clock = endMin; // advance clock by break duration
    minutesSinceBreak = 0; // reset break timer
  };

  // Walk sections in display order
  for (const section of orderedSections) {
    const list = activitiesBySection.get(section.id) || [];

    for (const activity of list) {
      // Before placing an activity, decide if a Break or Lunch should go first.
      const needBreak =
        !!config.breakIntervalMin &&
        !!config.breakDurationMin &&
        minutesSinceBreak + activity.durationMin > config.breakIntervalMin;

      const crossesLunch =
        !!config.lunchTargetMin &&
        !!config.lunchDurationMin &&
        !lunchInserted &&
        clock < config.lunchTargetMin &&
        clock + activity.durationMin > config.lunchTargetMin;

      if (crossesLunch) {
        pushBreak('Lunch', section.id, config.lunchDurationMin!);
        lunchInserted = true;
      } else if (needBreak) {
        pushBreak('Break', section.id, config.breakDurationMin!);
      }

      // Now place the activity row
      const startMin = clock;
      const endMin = clock + activity.durationMin;

      const row: ComputedActivityRow = {
        id: activity.id,
        type: 'activity',
        sectionId: section.id,
        computed: false,
        startMin,
        endMin,
        activity,
      };
      rows.push(row);

      // Advance clock and break tracker
      clock = endMin;
      minutesSinceBreak += activity.durationMin;

      // If we passed day end, insert an overflow marker once and stop computing further rows
      if (clock > config.dayEndMin) {
        const overflow: ComputedOverflowRow = {
          id: `overflow-${clock}`,
          type: 'overflow',
          sectionId: section.id,
          startMin: config.dayEndMin,
          endMin: clock,
          computed: true,
          label: 'Runs past end of day',
        };
        rows.push(overflow);
        return rows;
      }
    }
  }

  // If lunch was requested but not yet inserted and still within the day, try to insert at the end if target is after last item
  if (
    !!config.lunchTargetMin &&
    !!config.lunchDurationMin &&
    !lunchInserted &&
    clock <= config.dayEndMin &&
    config.lunchTargetMin >= config.dayStartMin
  ) {
    const lastSection = orderedSections.length ? orderedSections[orderedSections.length - 1] : undefined;
    pushBreak('Lunch', lastSection?.id ?? null, config.lunchDurationMin);
  }

  return rows;
}

// Plan injections (breaks/lunch) based on current config and activities.
// Returns an array of Injection records anchored before certain activities.
export function planInjections(
  config: DayConfig,
  sections: Section[],
  activities: Activity[],
): Injection[] {
  // Simulate walking across days, anchoring injections before activities that cross thresholds within each day.
  const orderedSections = [...sections].sort((a, b) => a.order - b.order);
  const bySection = new Map<ID, Activity[]>(orderedSections.map((s) => [s.id, []]));
  for (const a of activities) bySection.get(a.sectionId)?.push(a);

  const injections: Injection[] = [];
  const numDays = Math.max(1, config.numberOfDays ?? 1);
  const dayLen = Math.max(1, config.dayEndMin - config.dayStartMin);
  let dayIndex = 0;
  let clockWithinDay = 0; // minutes since day start
  let minutesSinceBreak = 0; // within current day
  let lunchPlanned = false; // within current day
  let preLunchBreakPlanned = false;
  let afterLunchStarted = false;
  let postLunchBreakPlanned = false;
  let lastActivityIdAfterLunch: ID | null = null;

  for (const section of orderedSections) {
    const list = bySection.get(section.id) || [];
    for (const activity of list) {
      // If this activity would overflow current day, move to next day (if any) before placing it
      if (clockWithinDay + activity.durationMin > dayLen) {
        // If day is ending and we haven't placed a post-lunch break yet, try to add one before the last post-lunch activity
        if (afterLunchStarted && !postLunchBreakPlanned && lastActivityIdAfterLunch && config.breakDurationMin && config.breakIntervalMin) {
          injections.push({
            id: `inj-break-post-${lastActivityIdAfterLunch}`,
            type: 'break',
            label: 'Break',
            sectionId: section.id,
            durationMin: config.breakDurationMin,
            anchorBeforeActivityId: lastActivityIdAfterLunch,
          });
          postLunchBreakPlanned = true;
        }
        if (dayIndex + 1 >= numDays) {
          // No more days; stop planning further injections
          return injections;
        }
        dayIndex++;
        clockWithinDay = 0;
        minutesSinceBreak = 0;
        lunchPlanned = false;
        preLunchBreakPlanned = false;
        afterLunchStarted = false;
        postLunchBreakPlanned = false;
        lastActivityIdAfterLunch = null;
      }

      const crossesBreak =
        !!config.breakIntervalMin &&
        !!config.breakDurationMin &&
        minutesSinceBreak + activity.durationMin > config.breakIntervalMin;

      const crossesLunch =
        !!config.lunchTargetMin &&
        !!config.lunchDurationMin &&
        !lunchPlanned &&
        (config.lunchTargetMin - config.dayStartMin) > 0 &&
        clockWithinDay < (config.lunchTargetMin - config.dayStartMin) &&
        clockWithinDay + activity.durationMin > (config.lunchTargetMin - config.dayStartMin);

      if (crossesLunch) {
        // Ensure at least one pre-lunch break when configured and feasible by placing it immediately before lunch if none yet
        if (!preLunchBreakPlanned && config.breakDurationMin && config.breakIntervalMin) {
          injections.push({
            id: `inj-break-pre-${activity.id}`,
            type: 'break',
            label: 'Break',
            sectionId: section.id,
            durationMin: config.breakDurationMin,
            anchorBeforeActivityId: activity.id,
          });
          preLunchBreakPlanned = true;
        }
        injections.push({
          id: `inj-lunch-${activity.id}`,
          type: 'lunch',
          label: 'Lunch',
          sectionId: section.id,
          durationMin: config.lunchDurationMin!,
          anchorBeforeActivityId: activity.id,
        });
        clockWithinDay += config.lunchDurationMin!;
        minutesSinceBreak = 0;
        lunchPlanned = true;
        afterLunchStarted = true;
        lastActivityIdAfterLunch = null;
      } else if (crossesBreak) {
        injections.push({
          id: `inj-break-${activity.id}`,
          type: 'break',
          label: 'Break',
          sectionId: section.id,
          durationMin: config.breakDurationMin!,
          anchorBeforeActivityId: activity.id,
        });
        clockWithinDay += config.breakDurationMin!;
        minutesSinceBreak = 0;
        if (afterLunchStarted) postLunchBreakPlanned = true;
      }

      // Advance clock by activity
      clockWithinDay += activity.durationMin;
      minutesSinceBreak += activity.durationMin;
      if (afterLunchStarted) lastActivityIdAfterLunch = activity.id;
    }
  }

  // If lunch requested but not yet planned for the last day, anchor lunch before first activity of last section
  if (!!config.lunchTargetMin && !!config.lunchDurationMin && !lunchPlanned && orderedSections.length && dayIndex < numDays) {
    const last = orderedSections[orderedSections.length - 1];
    const lastList = bySection.get(last.id) || [];
    if (lastList[0]) {
      injections.push({
        id: `inj-lunch-${lastList[0].id}`,
        type: 'lunch',
        label: 'Lunch',
        sectionId: last.id,
        durationMin: config.lunchDurationMin,
        anchorBeforeActivityId: lastList[0].id,
      });
    }
  }

  // Final check for last day: ensure one post-lunch break if after-lunch activities existed
  if (afterLunchStarted && !postLunchBreakPlanned && lastActivityIdAfterLunch && config.breakDurationMin && config.breakIntervalMin) {
    injections.push({
      id: `inj-break-post-${lastActivityIdAfterLunch}`,
      type: 'break',
      label: 'Break',
      sectionId: orderedSections[orderedSections.length - 1]?.id ?? (activities[0]?.sectionId as ID),
      durationMin: config.breakDurationMin,
      anchorBeforeActivityId: lastActivityIdAfterLunch,
    });
  }

  return injections;
}

// Build a schedule using explicit injections. Recomputes times for activities
// and places provided break/lunch rows at their anchors. Day start/end are respected.
export function buildScheduleWithInjections(
  config: Pick<DayConfig, 'dayStartMin' | 'dayEndMin' | 'numberOfDays'>,
  sections: Section[],
  activities: Activity[],
  injections: Injection[],
): ComputedRow[] {
  const orderedSections = [...sections].sort((a, b) => a.order - b.order);
  const bySection = new Map<ID, Activity[]>(orderedSections.map((s) => [s.id, []]));
  for (const a of activities) bySection.get(a.sectionId)?.push(a);

  const injMap = new Map<ID, Injection[]>();
  for (const inj of injections) {
    if (!injMap.has(inj.sectionId)) injMap.set(inj.sectionId, []);
    injMap.get(inj.sectionId)!.push(inj);
  }
  for (const [sid, arr] of injMap) arr.sort((a, b) => a.anchorBeforeActivityId.localeCompare(b.anchorBeforeActivityId));

  const rows: ComputedRow[] = [];
  const dayLen = Math.max(1, config.dayEndMin - config.dayStartMin);
  const numDays = Math.max(1, config.numberOfDays ?? 1);
  let dayIndex = 0;
  let clock = config.dayStartMin; // display clock within the current day

  for (const section of orderedSections) {
    const list = bySection.get(section.id) || [];
    const sectionInj = injMap.get(section.id) || [];

    for (const activity of list) {
      // Insert any injections anchored before this activity
      // If this activity would overflow the current day, carry it to next day if available
      if (clock + activity.durationMin > config.dayEndMin) {
        if (dayIndex + 1 >= numDays) {
          // No more days available; mark overflow and stop
          rows.push({
            id: `overflow-${clock}`,
            type: 'overflow',
            sectionId: section.id,
            startMin: config.dayEndMin,
            endMin: clock + activity.durationMin,
            computed: true,
            label: 'Runs past end of schedule',
          });
          return rows;
        }
        // Move to next day
        dayIndex++;
        clock = config.dayStartMin;
      }

      const anchored = sectionInj.filter((inj) => inj.anchorBeforeActivityId === activity.id);
      for (const inj of anchored) {
        // Ensure injections do not overflow the day; if so, move to next day
        if (clock + inj.durationMin > config.dayEndMin) {
          if (dayIndex + 1 >= numDays) {
            rows.push({
              id: `overflow-${clock}`,
              type: 'overflow',
              sectionId: section.id,
              startMin: config.dayEndMin,
              endMin: clock + inj.durationMin,
              computed: true,
              label: 'Runs past end of schedule',
            });
            return rows;
          }
          dayIndex++;
          clock = config.dayStartMin;
        }
        const startMin = clock;
        const endMin = clock + inj.durationMin;
        const row: ComputedBreakRow = {
          id: inj.id,
          type: inj.type,
          sectionId: section.id,
          startMin,
          endMin,
          computed: true,
          label: inj.label,
        };
        rows.push(row);
        clock = endMin;
      }

      // Now the activity row
      const startMin = clock;
      const endMin = clock + activity.durationMin;
      rows.push({
        id: activity.id,
        type: 'activity',
        sectionId: section.id,
        computed: false,
        startMin,
        endMin,
        activity,
      });
      clock = endMin;
    }
  }

  return rows;
}

// Build schedule purely from activities, respecting day boundaries and treating Lunch as a break period
// for the purposes of post-lunch break interval timing.
export function buildScheduleFromActivities(
  config: Pick<DayConfig, 'dayStartMin' | 'dayEndMin' | 'numberOfDays'>,
  sections: Section[],
  activities: Activity[],
): ComputedRow[] {
  // Order sections by day then order; fallback to order when dayNumber missing
  const orderedSections = [...sections].sort((a, b) => {
    const ad = a.dayNumber ?? 1;
    const bd = b.dayNumber ?? 1;
    if (ad !== bd) return ad - bd;
    return a.order - b.order;
  });
  const bySection = new Map<ID, Activity[]>(orderedSections.map((s) => [s.id, []]));
  for (const a of activities) bySection.get(a.sectionId)?.push(a);

  const rows: ComputedRow[] = [];
  const dayLen = Math.max(1, config.dayEndMin - config.dayStartMin);
  const numDays = Math.max(1, config.numberOfDays ?? 1);
  let dayIndex = 0;
  let clock = config.dayStartMin;
  let minutesSinceBreak = 0;
  let currentDayNumber = orderedSections.length ? (orderedSections[0].dayNumber ?? 1) : 1;

  for (const section of orderedSections) {
    const secDay = section.dayNumber ?? currentDayNumber;
    if (secDay !== currentDayNumber) {
      // New day: reset clock and break timer
      currentDayNumber = secDay;
      dayIndex = secDay - 1;
      clock = config.dayStartMin;
      minutesSinceBreak = 0;
    }
    const list = bySection.get(section.id) || [];
    for (const activity of list) {
      // Do not move to next day mid-section; allow overtime to continue.

      const startMin = clock;
      const endMin = clock + activity.durationMin;
      rows.push({
        id: activity.id,
        type: 'activity',
        sectionId: section.id,
        computed: false,
        startMin,
        endMin,
        activity,
      });
      clock = endMin;

      // Reset break interval timer on Lunch; otherwise accumulate
      if (activity.isSystem && activity.systemKey?.startsWith('lunch:day')) {
        minutesSinceBreak = 0;
      } else {
        minutesSinceBreak += activity.durationMin;
      }
    }
  }

  return rows;
}
