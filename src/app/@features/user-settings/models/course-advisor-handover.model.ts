/**
 * Handing a cohort from one Course Advisor to another.
 *
 * The counts are what WOULD move, shown before the Head agrees — a
 * handover redirects other people's work, so its size should not be a
 * surprise discovered in a success toast.
 */
export interface IHandoverCounts {
  /** Results sitting on the advisor's desk right now. */
  readonly resultsInFlight: number;
  /** Published results they are named on as a secondary reader. */
  readonly publishedResultLinks: number;
  /** Moderations on their desk or awaiting return to them. */
  readonly moderations: number;
  /** Advisory threads with their students. */
  readonly conversations: number;
  /** Transfer letters they raised that have not taken effect yet. */
  readonly transfers: number;
  /** Students in the cohort — they follow the post by derivation. */
  readonly students: number;
  /** Finished sets whose extra-year students go to the incoming advisor. */
  readonly extraYearSets?: number;
}

export interface IHandoverParty {
  readonly id: string;
  /** Their name, or their email where the account holds no personal name. */
  readonly name: string;
  readonly email: string;
  readonly assignedLevel: string | null;
}

export interface IHandoverPreview {
  readonly from: IHandoverParty;
  readonly to: IHandoverParty;
  readonly department: string;
  readonly level: string;
  readonly admissionYear: string | null;
  readonly moved: IHandoverCounts;
  /** Intakes of those finished sets, e.g. ["2022"]. */
  readonly extraYearIntakes?: readonly string[];
}

export interface IHandoverResult extends IHandoverPreview {
  readonly handoverId: string;
}
