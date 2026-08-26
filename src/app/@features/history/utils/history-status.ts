import { HistoryAction, IHistoryItem } from '../models/history.model';

/**
 * Badge colouring. Brand blue carries the positive verdict rather than green —
 * green is off-brand for Acheva (primary #2793FF, fail red #D8315B).
 */
export type HistoryTone = 'brand' | 'negative' | 'neutral';

interface HistoryBadge {
  readonly label: string;
  readonly tone: HistoryTone;
}

const APPROVED: HistoryBadge = { label: 'Approved', tone: 'brand' };
const REJECTED: HistoryBadge = { label: 'Rejected', tone: 'negative' };

/**
 * History answers ONE question: when this left your table, did you approve it
 * or reject it? It is a record of YOUR verdict, not the document's current
 * state — a result you approved months ago still reads "Approved" here even
 * though it is now PUBLISHED. Where it sits now is Result Management's job.
 *
 * Every row therefore HAS a verdict: the API only returns documents this
 * lecturer actually acted on. There is no "pending" state to render — a result
 * that has not reached you yet, or is sitting in your queue unactioned, is not
 * history and never appears here.
 *
 * Every way of passing a document on is a sign-off, so they all read
 * "Approved": a lecturer forwarding to the CC, a HOD or Dean approving, a CA
 * publishing, a HOD submitting a moderated score.
 */
const ACTION_LABELS: Readonly<Record<string, HistoryBadge>> = {
  // ── Result chain ────────────────────────────────────────────────────────
  APPROVED,
  /** The lecturer's forward to the CC IS their sign-off. */
  FORWARDED: APPROVED,
  /** The CA's publish is their sign-off. */
  PUBLISHED: APPROVED,
  REJECTED,

  // ── Moderation chain ────────────────────────────────────────────────────
  /** The CA submitting the letter is their sign-off. */
  SUBMITTED: APPROVED,
  /** The reviewing HOD's moderated score, forwarded on. */
  MODERATION_SUBMITTED: APPROVED,
  /** Legacy moderator assignment — still a hand-off. */
  ASSIGNED: APPROVED,

  /**
   * A withdrawal by the submitting CA. Deliberately NOT folded into either
   * verdict: nobody rejected it, and calling it an approval would be false.
   */
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

/** The STATUS column: the verdict this lecturer gave when it left their table. */
export function historyBadge(item: IHistoryItem): HistoryBadge {
  return (item.action && ACTION_LABELS[item.action]) || APPROVED;
}

/**
 * The preview's second date label follows the verdict — "Rejected on" reads
 * wrong above an approval timestamp.
 */
export function actionedOnLabel(action: HistoryAction | null): string {
  const badge = action ? ACTION_LABELS[action] : undefined;
  return badge ? `${badge.label} on` : 'Actioned on';
}
