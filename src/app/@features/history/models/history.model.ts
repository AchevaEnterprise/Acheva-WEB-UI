import { RoleEnum } from '../../auth/model/auth.model';

/**
 * History merges two independent workflows into one desk-scoped feed.
 * `kind` is the discriminant every consumer branches on.
 */
export enum HistoryKind {
  RESULT = 'RESULT',
  MODERATION = 'MODERATION',
}

/** What the viewer did to the document. Mirrors the backend `ApprovalStatus`. */
export enum HistoryResultAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FORWARDED = 'FORWARDED',
  PUBLISHED = 'PUBLISHED',
}

/** Mirrors the backend `ModerationAction`. */
export enum HistoryModerationAction {
  CREATED = 'CREATED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ASSIGNED = 'ASSIGNED',
  MODERATION_SUBMITTED = 'MODERATION_SUBMITTED',
  FORWARDED = 'FORWARDED',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
}

export type HistoryAction = HistoryResultAction | HistoryModerationAction;

export interface IHistoryPerson {
  readonly id: string;
  readonly name: string;
  readonly role: RoleEnum | null;
}

/** One table row. */
export interface IHistoryItem {
  readonly id: string;
  readonly kind: HistoryKind;
  readonly courseCode: string;
  readonly courseTitle: string;
  /** ISO — when the document last moved at THIS viewer's desk. */
  readonly date: string;
  readonly session: string;
  readonly semester: string;
  /** `null` when the document reached the viewer but they never acted on it. */
  readonly action: HistoryAction | null;
  /** Where the document sits now, independent of the viewer. */
  readonly documentStatus: string;
}

export interface IHistoryPage {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly data: readonly IHistoryItem[];
}

export interface IHistoryComment {
  readonly id: string;
  readonly author: IHistoryPerson | null;
  readonly comment: string;
  readonly createdAt: string;
  /** `WORKFLOW` = attached to an approve/reject; `DISCUSSION` = standalone note. */
  readonly source: 'WORKFLOW' | 'DISCUSSION';
}

/** The preview drawer payload. */
export interface IHistoryDetail extends IHistoryItem {
  readonly level: string | null;
  readonly department: string | null;
  readonly courseCoordinator: IHistoryPerson | null;
  /** ISO — when the document was handed to this viewer, if knowable. */
  readonly receivedOn: string | null;
  /** ISO — when this viewer acted. `null` if they never did. */
  readonly actionedOn: string | null;
  readonly comments: readonly IHistoryComment[];
}

export interface IHistoryQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly search?: string;
  readonly kind?: HistoryKind;
  readonly session?: string;
  readonly semester?: string;
  /** `yyyy-MM-dd` — the API widens `endDate` to end-of-day. */
  readonly startDate?: string;
  readonly endDate?: string;
}
