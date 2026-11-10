/**
 * Who has paid their school fees — `GET /school-fees/students` (2026-11-09).
 * The Head sees the department; a Course Advisor sees their own students
 * (current set and finished sets' extra-year students). Amounts are KOBO.
 */

export type SchoolFeeStatus =
  | 'PAID'
  | 'PARTIAL'
  | 'NOT_STARTED'
  | 'OPTION_REQUIRED'
  | 'NO_FEE';

export interface ISchoolFeeStudentRow {
  readonly _id: string;
  readonly fullName: string;
  readonly registrationNumber: string;
  /** "300 Level", "Extra Year 1". */
  readonly standingLabel: string;
  /** The level whose fee applies — the final one in extra year. */
  readonly level: string | null;
  readonly option: string | null;
  readonly status: SchoolFeeStatus;
  readonly totalKobo: number | null;
  readonly paidKobo: number;
  readonly outstandingKobo: number | null;
  readonly paymentsMade: number;
  readonly paymentsAllowed: number | null;
  readonly lastPaidAt: string | null;
  readonly nextDueDate: string | null;
  /** A payment that was due has not been made. */
  readonly overdue: boolean;
  /** Receipts uploaded for payments made elsewhere — counted, checked later. */
  readonly receipts: readonly ISchoolFeeReceiptSummary[];
}

export interface ISchoolFeeReceiptSummary {
  readonly _id: string;
  readonly rrr: string;
  readonly amountKobo: number;
  readonly status: 'UNCHECKED' | 'VERIFIED' | 'REJECTED';
  readonly uploadedAt: string | null;
}

export interface ISchoolFeeSummary {
  readonly students: number;
  readonly paid: number;
  readonly partial: number;
  readonly notStarted: number;
  readonly optionRequired: number;
  readonly noFee: number;
  readonly overdue: number;
  readonly uncheckedReceipts: number;
  readonly collectedKobo: number;
  readonly outstandingKobo: number;
}

export interface ISchoolFeeList {
  /** Null before the university opens its first session. */
  readonly session: string | null;
  readonly scope: 'DEPARTMENT' | 'ADVISOR';
  /** False until Acheva publishes the session's fees. */
  readonly published: boolean;
  readonly instalments: readonly { position: number; dueDate: string }[];
  readonly summary: ISchoolFeeSummary | null;
  readonly levels: readonly string[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly data: readonly ISchoolFeeStudentRow[];
}

export interface ISchoolFeeListQuery {
  readonly status?: SchoolFeeStatus | '';
  readonly level?: string;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}
