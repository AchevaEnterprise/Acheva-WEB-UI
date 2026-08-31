/**
 * SHARED LOGIC — mirrored in
 * `acheva-student-WEB-UI/src/app/features/transcript/models/transcript.model.ts`.
 *
 * The two portals share no package, so this is a deliberate copy. A student's
 * transcript and the copy their Course Advisor prints must be the SAME
 * document; if these two files drift, two people holding what they believe is
 * one record are holding two. Change one, change the other.
 *
 * The two copies are NOT byte-identical and cannot be: the repos run Prettier
 * at different print widths, so each is formatted to its own house style. Only
 * the formatting may differ — every value, string and rule here must match.
 */
/**
 * The transcript payload, mirroring `ITranscript` in the backend
 * (`acheva-nestjs/src/transcript/transcript.types.ts`).
 *
 * Kept in step by hand, the same way `result-sheet.model.ts` mirrors
 * `result-sheet.types.ts` — the two repos share no package. Change one, change
 * the other.
 *
 * Every figure here is COMPUTED SERVER-SIDE. Nothing in this app recalculates
 * a GPA or a grade point: the whole value of a transcript is that the figures
 * on the paper are the figures of record, and a second implementation of the
 * arithmetic is a second chance to disagree with them.
 */
export interface ITranscript {
  readonly institution: string;
  readonly student: ITranscriptStudent;
  /** Chronological, oldest first. */
  readonly sessions: readonly ITranscriptSession[];
  readonly cumulative: ITranscriptTotals;
  readonly gradingScale: readonly ITranscriptGradeBand[];
  readonly classificationScales: readonly ITranscriptClassificationScale[];
  readonly courseAdvisor: string | null;
  readonly generatedAt: string;
  readonly notices: readonly string[];
}

export interface ITranscriptStudent {
  readonly fullName: string;
  readonly registrationNumber: string;
  readonly school: string;
  readonly department: string;
  /** Null when unrecorded — the PDF omits the row rather than printing a gap. */
  readonly sex: string | null;
  readonly dateOfBirth: string | null;
  readonly nationality: string | null;
  readonly stateOfOrigin: string | null;
  readonly modeOfEntry: string | null;
  readonly programmeOption: string | null;
  readonly dateOfEntry: string | null;
}

export interface ITranscriptSession {
  readonly session: string;
  /** The carry-forward line; null for the first session on the document. */
  readonly broughtForward: ITranscriptTotals | null;
  readonly semesters: readonly ITranscriptSemester[];
  readonly totals: ITranscriptTotals;
  readonly cumulative: ITranscriptTotals;
}

export interface ITranscriptSemester {
  readonly semester: string;
  readonly label: string;
  /** "2017/2018 HARMATTAN SEMESTER" — the printed heading, built server-side. */
  readonly heading: string;
  readonly level: string | null;
  readonly courses: readonly ITranscriptCourse[];
  readonly totals: ITranscriptTotals;
  readonly cumulative: ITranscriptTotals;
}

export interface ITranscriptCourse {
  readonly code: string;
  readonly title: string;
  readonly units: number | null;
  readonly grade: string | null;
  /** Null, never 0, when the row does not count toward the totals. */
  readonly gradePoints: number | null;
  readonly total: number | null;
  readonly status: string | null;
  readonly moderated: boolean;
  readonly counted: boolean;
}

export interface ITranscriptTotals {
  readonly units: number;
  readonly gradePoints: number;
  readonly gpa: number;
}

export interface ITranscriptGradeBand {
  readonly grade: string;
  readonly min: number;
  readonly max: number;
  readonly points: number;
  readonly description: string;
}

export interface ITranscriptClassificationScale {
  readonly era: string;
  readonly bands: readonly ITranscriptClassificationBand[];
}

export interface ITranscriptClassificationBand {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

/** What `POST /transcripts/.../issue` returns: the serial plus its document. */
export interface IIssuedTranscript {
  readonly serial: string;
  readonly kind: string;
  readonly issuedAt: string;
  readonly verifyUrl: string;
  readonly contentHash: string;
  readonly transcript: ITranscript;
}
