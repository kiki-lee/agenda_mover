// Core data models for the Agenda Mover app
// These types define the shape of activities, sections, and computed schedule rows.

export type ID = string;

export interface Activity {
  id: ID; // unique identifier for drag-and-drop and updates
  title: string; // activity name
  owner: string; // who is running it
  slideNumber?: string; // corresponding slide number (text to allow ranges like "12-14")
  durationMin: number; // duration in minutes
  files?: string; // associated files (comma-separated or URLs)
  details?: string; // extra details
  notes?: string; // notes for facilitators
  sectionId: ID; // the section this activity belongs to
  isSystem?: boolean; // true if auto-generated (Break/Lunch)
  systemKey?: string; // stable key to find/update system activities
  completed?: boolean; // user indicates activity done
}

export interface Section {
  id: ID;
  name: string; // e.g., "Day 1: Morning"
  order: number; // for display ordering
  dayNumber?: number; // which day this section belongs to (1..N)
}

export interface DayConfig {
  dayStartMin: number; // minutes from midnight for day start
  dayEndMin: number; // minutes from midnight for day end
  numberOfDays?: number; // how many days the agenda spans (default 1)
  breakIntervalMin?: number; // general interval between breaks (minutes)
  breakDurationMin?: number; // break length (minutes)
  lunchTargetMin?: number; // approximate lunch start time (minutes from midnight)
  lunchDurationMin?: number; // lunch length (minutes)
}

export type RowType = 'activity' | 'break' | 'lunch' | 'overflow';

export interface ComputedRowBase {
  id: ID; // unique id for rendering lists
  type: RowType;
  sectionId: ID | null; // section the row is shown under (break/lunch can be null or last section crossed)
  startMin: number; // computed start time in minutes from midnight
  endMin: number; // computed end time in minutes from midnight
  computed: boolean; // true for generated rows like breaks/lunch
}

export interface ComputedActivityRow extends ComputedRowBase {
  type: 'activity';
  activity: Activity;
}

export interface ComputedBreakRow extends ComputedRowBase {
  type: 'break' | 'lunch';
  label: string; // e.g. "Break" or "Lunch"
}

export interface ComputedOverflowRow extends ComputedRowBase {
  type: 'overflow';
  label: string; // indicates schedule extends past end-of-day
}

export type ComputedRow =
  | ComputedActivityRow
  | ComputedBreakRow
  | ComputedOverflowRow;

// Persistent injection record for placing computed rows only when user applies settings
export interface Injection {
  id: ID;
  type: 'break' | 'lunch';
  label: string;
  sectionId: ID; // section where the break/lunch appears
  durationMin: number;
  // Insert before the activity with this id. If that activity is deleted, the injection is dropped.
  anchorBeforeActivityId: ID;
}
