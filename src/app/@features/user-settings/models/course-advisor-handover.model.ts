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
}

export interface IHandoverResult extends IHandoverPreview {
  readonly handoverId: string;
}
