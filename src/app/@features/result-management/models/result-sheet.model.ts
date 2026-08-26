/**
 * The printable/exportable result sheet, as returned by
 * `GET /results/:id/sheet`. Mirrors `IResultSheet` in the API.
 *
 * Layout-agnostic on purpose: it carries the FACTS of the sheet, not their
 * arrangement. The PDF and the spreadsheet both render this one object, which
 * is what keeps the two exports identical.
 */
export interface IResultSheet {
  readonly course: {
    readonly code: string;
    readonly title: string;
    readonly unitLoad: number | null;
    readonly assessmentShape: 'THEORY' | 'PRACTICAL_ONLY';
  };
  readonly institution: string;
  readonly studentSchool: IResultSheetOrgUnit;
  readonly offeringSchool: IResultSheetOrgUnit;
  readonly department: IResultSheetOrgUnit;
  readonly session: string;
  readonly semester: string;
  /** What FUTO prints — HARMATTAN or RAIN. */
  readonly semesterLabel: string;
  readonly level: string;
  readonly status: string;
  readonly publishedAt: string | null;
  readonly lecturer: IResultSheetPerson | null;
  readonly courseCoordinator: IResultSheetPerson | null;
  readonly entries: readonly IResultSheetEntry[];
  readonly summary: IResultSheetSummary;
  readonly approvals: readonly IResultSheetApproval[];
  readonly gradingScale: ReadonlyArray<{
    readonly grade: string;
    readonly min: number;
    readonly max: number;
  }>;
  readonly generatedAt: string;
  /** True when the viewer sees only their own students. */
  readonly partial: boolean;
  readonly categories: readonly string[];
}

export interface IResultSheetOrgUnit {
  readonly name: string;
  readonly code: string;
}

export interface IResultSheetPerson {
  readonly name: string;
  readonly role: string | null;
}

export interface IResultSheetEntry {
  readonly serial: number;
  readonly registrationNumber: string;
  readonly fullName: string;
  readonly programme: string;
  readonly test: number | null;
  readonly lab: number | null;
  readonly exam: number | null;
  readonly total: number | null;
  readonly grade: string | null;
  readonly status: 'PASS' | 'FAIL' | null;
  readonly units: number | null;
  readonly category: string;
  readonly moderated: boolean;
  readonly voided: boolean;
  readonly awaitingRegistrationDecision: boolean;
}

export interface IResultSheetSummary {
  readonly total: number;
  readonly totalPass: number;
  readonly totalFail: number;
  readonly averageTotal: number;
  readonly percentagePass: number;
  readonly percentageFail: number;
  readonly distribution: Readonly<Record<string, number>>;
}

export interface IResultSheetApproval {
  readonly action: string;
  readonly name: string;
  readonly role: string;
  readonly date: string;
  readonly comment: string | null;
}

export type ExportFormat = 'PDF' | 'EXCEL';
