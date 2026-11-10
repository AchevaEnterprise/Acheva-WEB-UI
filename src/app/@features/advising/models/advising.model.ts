/**
 * A Course Advisor's sets — `GET /advising/sets` and
 * `GET /advising/sets/:admissionYear/students`. Advisors follow their set
 * from the level they take it at to final year (2026-11-09); a finished
 * set's extra-year students stay with them.
 */

export type AcademicStanding =
  | 'IN_PROGRAMME'
  | 'AWAITING_RESULTS'
  | 'EXTRA_YEAR'
  | 'GRADUATED';

export interface ISetCounts {
  readonly total: number;
  readonly inProgramme: number;
  readonly extraYear: number;
  /** Final year over, a registered course still without a result. */
  readonly awaitingResults: number;
  readonly graduated: number;
}

export interface ICurrentSet extends ISetCounts {
  readonly admissionYear: string;
  readonly level: string;
  readonly startedSession: string | null;
}

export interface IExtraYearSet {
  readonly admissionYear: string;
  readonly completedSession: string | null;
  /** Students of the set in extra year or awaiting their final results. */
  readonly students: number;
  readonly awaitingResults: number;
}

export interface IPreviousSet extends ISetCounts {
  readonly id: string;
  readonly admissionYear: string;
  /** COMPLETED: seen through final year. ENDED: left before then. */
  readonly status: 'COMPLETED' | 'ENDED';
  readonly endedReason:
    | 'SET_COMPLETED'
    | 'HANDED_OVER'
    | 'UNASSIGNED'
    | 'REASSIGNED'
    | null;
  readonly startedSession: string | null;
  readonly startedLevel: string | null;
  readonly endedSession: string | null;
  readonly endedLevel: string | null;
}

export interface IMySets {
  readonly current: ICurrentSet | null;
  readonly extraYear: readonly IExtraYearSet[];
  readonly previous: readonly IPreviousSet[];
}

export interface ISetStudent {
  readonly _id: string;
  readonly fullName: string;
  readonly registrationNumber: string;
  readonly email: string | null;
  readonly level: string;
  readonly academicStanding: AcademicStanding;
  readonly extraYear: number;
  readonly graduatedSession: string | null;
  /** The session an AWAITING_RESULTS student is waiting on. */
  readonly pendingSession: string | null;
  readonly isActive: boolean;
  /** "Extra Year 2", "Awaiting final results", "Graduated", "500 Level". */
  readonly standingLabel: string;
  /** Course codes an extra-year student still has to write. */
  readonly owes: readonly string[];
  /** Registered courses whose results are not out — what an awaiting student waits on. */
  readonly awaiting: readonly string[];
}

export interface ISetStudents {
  readonly admissionYear: string;
  readonly view: 'extra-year' | 'all';
  readonly students: readonly ISetStudent[];
}
