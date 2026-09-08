/**
 * The import dry-run, mirroring `IImportPreview` in the backend
 * (`acheva-nestjs/src/results/utils/import-classification.ts`).
 *
 * Kept in step by hand, as `result-sheet.model.ts` is — the two repos share no
 * package. Nothing here is decided in the browser: every verdict is the
 * server's, so the modal shows exactly what the import will do.
 */

export type ImportRowProblem =
  | 'MISSING_REGISTRATION_NUMBER'
  | 'DIFFERENT_DEPARTMENT'
  | 'DUPLICATE_IN_FILE'
  /** Backfill only — a student of this department, but another cohort. */
  | 'NOT_YOUR_STUDENT'
  /** Backfill only — nobody holds this number; enrol them first. */
  | 'NOT_ON_YOUR_LIST';

export type ImportCategory = 'REGULAR' | 'REFERENCE' | 'UNREGISTERED';

export interface IImportRowScores {
  readonly test: number | null;
  readonly lab: number | null;
  readonly exam: number | null;
  readonly total: number | null;
  readonly grade: string | null;
}

export interface IImportRowVerdict {
  readonly rowNumber: number;
  readonly scores: IImportRowScores | null;
  readonly registrationNumber: string;
  readonly nameInFile: string | null;
  /** The Course Advisor's name for this number — the one that gets recorded. */
  readonly nameOnRecord: string | null;
  readonly category: ImportCategory | null;
  readonly inClassList: boolean;
  readonly nameAgrees: boolean;
  /** On the class list, but the name looks like a different person. */
  readonly needsConfirmation: boolean;
  readonly problem: ImportRowProblem | null;
  /** For DIFFERENT_DEPARTMENT — the department the student really belongs to. */
  readonly belongsToDepartment: string | null;
  /** For DUPLICATE_IN_FILE — the other rows carrying this same number. */
  readonly duplicateOf: readonly number[];
}

export interface IClassListMember {
  readonly registrationNumber: string;
  readonly fullName: string;
}

export type ImportAdvisory =
  | 'TOTAL_DISAGREES_WITH_PARTS'
  | 'GRADE_DISAGREES_WITH_TOTAL'
  | 'REPLACES_EXISTING_SCORE'
  | 'NO_SCORE_AT_ALL';

/** Wording mirrored from the backend so both say the same thing. */
export const ADVISORY_TEXT: Readonly<Record<ImportAdvisory, string>> = {
  TOTAL_DISAGREES_WITH_PARTS:
    'The total does not match the test, lab and exam scores added together.',
  GRADE_DISAGREES_WITH_TOTAL:
    'The grade is not the one this total earns on the current scale. This is ' +
    'expected if the result was graded under an older scale.',
  REPLACES_EXISTING_SCORE:
    'A score is already recorded for this student. Importing replaces it.',
  NO_SCORE_AT_ALL:
    'No total and no test, lab or exam score — there is nothing to record.',
};

export interface IImportPreview {
  /** True when a Course Advisor is backfilling already-approved history. */
  readonly isBackfill: boolean;
  /** Per row, keyed by row number. Empty on a lecturer's import. */
  readonly advisories: Readonly<Record<number, readonly ImportAdvisory[]>>;
  readonly totalRows: number;
  readonly regular: number;
  readonly reference: number;
  readonly unregistered: number;
  readonly needsConfirmation: number;
  readonly problems: number;
  readonly rows: readonly IImportRowVerdict[];
  /** Lets a corrected registration number be re-checked without a round trip. */
  readonly classList: readonly IClassListMember[];
}

/** The decisions taken in the preview modal, sent back with the import. */
export interface IImportResolutions {
  /** Corrected registration numbers, keyed by row number. */
  readonly corrections?: Record<number, string>;
  /** For each clash, the row the lecturer kept. */
  readonly chosenRows?: readonly number[];
}

/**
 * What the import actually did. The counts are reported rather than assumed —
 * a row that was read but not recorded has to be visible.
 */
export interface IImportOutcome {
  readonly rowsRead: number;
  readonly recorded: number;
  readonly skipped: ReadonlyArray<{
    readonly rowNumber: number;
    readonly registrationNumber: string;
    readonly reason: ImportRowProblem | null;
  }>;
}
