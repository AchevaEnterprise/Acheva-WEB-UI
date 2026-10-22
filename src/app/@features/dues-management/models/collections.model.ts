/**
 * Who has paid the department's dues, and who has not.
 *
 * Every amount is **KOBO**, the integer minor unit, exactly as the server
 * sends it. Nothing here holds naira and nothing divides by 100 —
 * `formatNaira` is the single place the two meet.
 */

export type DuesStandingStatus = 'PAID' | 'PARTIAL' | 'NOT_STARTED';

/** One payment a student actually made. */
export interface IDuesPayment {
  /** KOBO. */
  readonly amount: number;
  readonly reference: string;
  readonly paidAt: string;
}

export interface IDuesCollectionRow {
  readonly studentId: string;
  readonly fullName: string | null;
  readonly registrationNumber: string | null;
  readonly level: string | null;
  /** KOBO. */
  readonly paidKobo: number;
  readonly outstandingKobo: number;
  /**
   * Payments MADE, not instalments the plan allows. A student who cleared
   * the whole due in one transfer used one, whatever the schedule permits.
   */
  readonly paymentsMade: number;
  readonly lastPaidAt: string | null;
  readonly status: DuesStandingStatus;
  /** Each payment, so the dates and amounts can be shown in full. */
  readonly payments: IDuesPayment[];
}

/**
 * Over the WHOLE cohort, never the filtered rows — a headline count that
 * moved with the filter could not be read.
 */
export interface IDuesCollectionSummary {
  readonly students: number;
  readonly paid: number;
  readonly partial: number;
  readonly notStarted: number;
  /** KOBO actually taken for this plan. */
  readonly collectedKobo: number;
  /** KOBO the whole cohort would pay if everyone settled. */
  readonly expectedKobo: number;
}

export interface IDuesCollectionPlan {
  readonly id: string;
  readonly session: string;
  readonly title: string;
  /** KOBO. */
  readonly totalAmount: number;
  readonly status: string;
  readonly instalments: readonly { position: number; amount: number }[];
}

export interface IDuesCollectionsPage {
  readonly session: string;
  /** `null` when the department has published no plan for the session. */
  readonly plan: IDuesCollectionPlan | null;
  readonly summary: IDuesCollectionSummary | null;
  /** The levels actually present in the cohort, for the switcher. */
  readonly levels: string[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly rows: IDuesCollectionRow[];
}
