import { RoleEnum } from '../../auth/model/auth.model';
import {
  IModerationLecturer,
  IResultModeration,
  ModerationScope,
  ModerationStatus,
} from '../models/moderation.model';

/**
 * Mirrors the authoritative backend in:
 *   - `acheva-nestjs/src/moderation/services/moderation.service.ts`
 *   - `acheva-nestjs/src/moderation/moderation.enum.ts`
 *
 * Two flows depending on the moderation scope — the reviewing HOD moderates
 * the score INLINE (no moderator assignment step):
 *
 *   INTERNAL:
 *     CA (letter) → Home HOD (reviews history + moderates score) → Dean
 *        → Home HOD (post-dean) → CA (publish)
 *
 *   CROSS_DEPARTMENT:
 *     CA (letter) → Home HOD (eligibility review) → Offering HOD
 *        (reviews history + moderates score) → Dean → Offering HOD (return)
 *        → Home HOD (return) → CA (publish)
 *
 * The backend tracks the active step on `currentHandler` — UI gating below
 * always starts from "is the current user the current handler?".
 */

// ─── Status grouping & labels ───────────────────────────────────────────────

export const MODERATION_PENDING_STATUSES: readonly ModerationStatus[] = [
  ModerationStatus.PENDING_HOME_HOD,
  ModerationStatus.PENDING_OFFERING_HOD,
  ModerationStatus.PENDING_MODERATION, // legacy docs only
  ModerationStatus.PENDING_OFFERING_HOD_REVIEW, // legacy docs only
  ModerationStatus.PENDING_DEAN,
  ModerationStatus.PENDING_RETURN_HOME_HOD,
  ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
  ModerationStatus.PENDING_RETURN_CA,
];

export const MODERATION_REJECTED_STATUSES: readonly ModerationStatus[] = [
  ModerationStatus.REJECTED_HOME_HOD,
  ModerationStatus.REJECTED_OFFERING_HOD,
  ModerationStatus.REJECTED_DEAN,
];

export const MODERATION_TERMINAL_STATUSES: readonly ModerationStatus[] = [
  ModerationStatus.PUBLISHED,
  ModerationStatus.CANCELLED,
];

const STATUS_LABELS: Record<ModerationStatus, string> = {
  [ModerationStatus.DRAFT]: 'Draft',
  [ModerationStatus.PENDING_HOME_HOD]: 'Awaiting Home HOD',
  [ModerationStatus.PENDING_OFFERING_HOD]: 'Awaiting Offering HOD',
  [ModerationStatus.PENDING_MODERATION]: 'Awaiting Moderator (legacy)',
  [ModerationStatus.PENDING_OFFERING_HOD_REVIEW]:
    'Awaiting HOD Review (legacy)',
  [ModerationStatus.PENDING_DEAN]: 'Awaiting Dean',
  [ModerationStatus.PENDING_RETURN_HOME_HOD]: 'Returning to Home HOD',
  [ModerationStatus.PENDING_HOME_HOD_POST_DEAN]: 'Awaiting Home HOD',
  [ModerationStatus.PENDING_RETURN_CA]: 'Awaiting Course Advisor',
  [ModerationStatus.APPROVED_READY_TO_PUBLISH]: 'Ready to Publish',
  [ModerationStatus.PUBLISHED]: 'Published',
  [ModerationStatus.REJECTED_HOME_HOD]: 'Rejected (Home HOD)',
  [ModerationStatus.REJECTED_OFFERING_HOD]: 'Rejected (Offering HOD)',
  [ModerationStatus.REJECTED_DEAN]: 'Rejected (Dean)',
  [ModerationStatus.CANCELLED]: 'Cancelled',
};

export type ModerationStatusVariant =
  | 'draft'
  | 'pending'
  | 'rejected'
  | 'ready'
  | 'published'
  | 'cancelled';

export function moderationStatusLabel(status: ModerationStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function moderationStatusVariant(
  status: ModerationStatus
): ModerationStatusVariant {
  if (status === ModerationStatus.DRAFT) return 'draft';
  if (status === ModerationStatus.APPROVED_READY_TO_PUBLISH) return 'ready';
  if (status === ModerationStatus.PUBLISHED) return 'published';
  if (status === ModerationStatus.CANCELLED) return 'cancelled';
  if (MODERATION_REJECTED_STATUSES.includes(status)) return 'rejected';
  return 'pending';
}

// ─── Moderated score policy (grade E) ───────────────────────────────────────

/** Inclusive band a moderated total must land in — grade E, the minimum pass. */
export const MODERATED_TOTAL_MIN = 40;
export const MODERATED_TOTAL_MAX = 44;

export interface IGeneratedScores {
  test: number;
  lab?: number;
  exam: number;
  total: number;
}

/**
 * Random scores summing to a grade-E total (40–44). The split mirrors a
 * natural mark distribution (exam-heavy). Mirrors the backend rule in
 * `ModerationService.hodModerate` — the server independently re-validates.
 */
export function generateModeratedScores(hasLab: boolean): IGeneratedScores {
  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const total = rand(MODERATED_TOTAL_MIN, MODERATED_TOTAL_MAX);
  if (hasLab) {
    const lab = rand(3, 8);
    const test = rand(6, 12);
    return { test, lab, exam: total - lab - test, total };
  }
  const test = rand(8, 15);
  return { test, exam: total - test, total };
}

/** True when test/lab/exam sum into the E band. */
export function isModeratedTotalValid(
  test: number,
  lab: number | undefined,
  exam: number
): boolean {
  const total = (test || 0) + (lab || 0) + (exam || 0);
  return total >= MODERATED_TOTAL_MIN && total <= MODERATED_TOTAL_MAX;
}

// ─── Reference helpers ──────────────────────────────────────────────────────

/** Extract a hex id from any populated/unpopulated reference field. */
export function refId(
  ref: string | { _id?: string } | null | undefined
): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id ?? '';
}

export function isCross(mod: IResultModeration): boolean {
  return mod.moderationScope === ModerationScope.CROSS_DEPARTMENT;
}

/** True when this user is the lecturer the workflow is currently waiting on. */
export function isMyTurn(
  mod: IResultModeration,
  lecturerId: string | undefined
): boolean {
  if (!lecturerId) return false;
  return refId(mod.currentHandler) === lecturerId;
}

export function isSubmitter(
  mod: IResultModeration,
  lecturerId: string | undefined
): boolean {
  if (!lecturerId) return false;
  return refId(mod.submittedBy) === lecturerId;
}

/**
 * For HODs we additionally need to know which department(s) they own —
 * `currentHandler` already tells us *if* they should act, but `homeDept` vs
 * `offeringDept` decides *which set of buttons* (cross-approval vs. moderate).
 */
export function lecturerDeptId(
  lecturer: Pick<IModerationLecturer, 'department'> | undefined | null
): string {
  if (!lecturer) return '';
  return refId(lecturer.department as never);
}

// ─── Action descriptors used by the UI ──────────────────────────────────────

export type ModerationActionTone = 'primary' | 'destructive' | 'secondary';

export type ModerationActionKind =
  // CA
  | 'editDraft'
  | 'submit'
  | 'cancel'
  | 'publish'
  // Home HOD
  | 'homeHodApproveCross'
  | 'homeHodReject'
  | 'homeHodForwardToCa'
  // Offering HOD (cross only)
  | 'offeringHodReject'
  | 'offeringHodForwardAfterDean'
  // Reviewing HOD moderates inline (home HOD internal / offering HOD cross)
  | 'hodModerate'
  // Dean
  | 'deanApprove'
  | 'deanReject';

export interface IModerationAction {
  kind: ModerationActionKind;
  label: string;
  tone: ModerationActionTone;
  /** Short blurb shown as a tooltip / help text. */
  description: string;
  /**
   * `reject` opens the reason dialog, `score` reveals the moderation score
   * panel, `navigate` routes elsewhere (draft editing), `confirm` is a yes/no.
   */
  flow: 'confirm' | 'reject' | 'score' | 'navigate';
}

interface IRoleContext {
  /** The signed-in lecturer's id. */
  userId: string;
  /** Their primary role. Note: HOD vs. CA gating sometimes depends on this. */
  role: RoleEnum;
  /** The signed-in lecturer's department id (only needed for HOD branching). */
  departmentId?: string;
}

/**
 * Returns the actions the current user may perform on this moderation right
 * now. Pages render these as buttons in declaration order. Empty array means
 * "no actions available" — UI should show a read-only banner.
 */
export function getAvailableActions(
  mod: IResultModeration,
  ctx: IRoleContext
): IModerationAction[] {
  const actions: IModerationAction[] = [];

  // CA handles draft + final publish + cancel from any cancellable state.
  if (ctx.role === RoleEnum.COURSE_ADVISOR && isSubmitter(mod, ctx.userId)) {
    if (mod.status === ModerationStatus.DRAFT) {
      actions.push({
        kind: 'editDraft',
        label: 'Edit letter',
        tone: 'secondary',
        description: 'Open the letter editor to continue writing this draft.',
        flow: 'navigate',
      });
      actions.push(submit());
      actions.push(cancel('Cancel draft'));
      return actions;
    }
    if (
      mod.status === ModerationStatus.APPROVED_READY_TO_PUBLISH &&
      isMyTurn(mod, ctx.userId)
    ) {
      actions.push(publish());
      return actions;
    }
    if (
      mod.status === ModerationStatus.REJECTED_HOME_HOD ||
      mod.status === ModerationStatus.REJECTED_OFFERING_HOD ||
      mod.status === ModerationStatus.REJECTED_DEAN
    ) {
      actions.push(cancel('Cancel request'));
      return actions;
    }
  }

  // The rest of the workflow is gated by `currentHandler`.
  if (!isMyTurn(mod, ctx.userId)) return actions;

  switch (mod.status) {
    case ModerationStatus.PENDING_HOME_HOD: {
      if (isCross(mod)) {
        actions.push({
          kind: 'homeHodApproveCross',
          label: 'Approve & forward to offering HOD',
          tone: 'primary',
          description:
            'The student is eligible — route this request to the HOD of the course-owning department, who will moderate the score.',
          flow: 'confirm',
        });
      } else {
        actions.push(moderate());
      }
      actions.push(reject('homeHodReject', 'Reject to Course Advisor'));
      return actions;
    }

    case ModerationStatus.PENDING_OFFERING_HOD: {
      actions.push(moderate());
      actions.push(reject('offeringHodReject', 'Reject to Course Advisor'));
      return actions;
    }

    case ModerationStatus.PENDING_DEAN: {
      actions.push({
        kind: 'deanApprove',
        label: 'Approve moderated result',
        tone: 'primary',
        description:
          'Approve the moderated score; it returns through the HOD chain for publishing.',
        flow: 'confirm',
      });
      actions.push(reject('deanReject', 'Reject to HOD'));
      return actions;
    }

    case ModerationStatus.PENDING_RETURN_HOME_HOD: {
      // Cross-department only. Offering HOD forwards back to the home HOD.
      actions.push({
        kind: 'offeringHodForwardAfterDean',
        label: 'Forward to home HOD',
        tone: 'primary',
        description:
          'Hand the Dean-approved result back to the student’s home department HOD.',
        flow: 'confirm',
      });
      return actions;
    }

    case ModerationStatus.PENDING_HOME_HOD_POST_DEAN:
    case ModerationStatus.PENDING_RETURN_CA: {
      actions.push({
        kind: 'homeHodForwardToCa',
        label: 'Forward to Course Advisor',
        tone: 'primary',
        description:
          'Send the approved moderation back to the Course Advisor so it can be published.',
        flow: 'confirm',
      });
      return actions;
    }

    default:
      // Legacy statuses (PENDING_MODERATION / PENDING_OFFERING_HOD_REVIEW)
      // have no actions in the new flow — they render read-only.
      return actions;
  }
}

// ─── Action factories (kept private to ensure consistent copy) ──────────────

function submit(): IModerationAction {
  return {
    kind: 'submit',
    label: 'Submit to HOD',
    tone: 'primary',
    description:
      'Move this draft into the moderation workflow and send it to your HOD.',
    flow: 'confirm',
  };
}

function cancel(label: string): IModerationAction {
  return {
    kind: 'cancel',
    label,
    tone: 'destructive',
    description:
      'Cancel this request. You can always create a new moderation later.',
    flow: 'confirm',
  };
}

function publish(): IModerationAction {
  return {
    kind: 'publish',
    label: 'Publish moderated result',
    tone: 'primary',
    description:
      'Publish the moderated score. The failing grade in the original published result is replaced and marked as moderated.',
    flow: 'confirm',
  };
}

function moderate(): IModerationAction {
  return {
    kind: 'hodModerate',
    label: 'Moderate score',
    tone: 'primary',
    description:
      'Generate (or enter) the moderated scores — the total must be a grade E — and forward to the Dean.',
    flow: 'score',
  };
}

function reject(kind: ModerationActionKind, label: string): IModerationAction {
  return {
    kind,
    label,
    tone: 'destructive',
    description:
      'Capture a reason and return the request to the Course Advisor.',
    flow: 'reject',
  };
}

// ─── Timeline ───────────────────────────────────────────────────────────────

export interface IModerationTimelineStep {
  /** Displayed label for the step (top-level). */
  label: string;
  /** Sub-label, usually the role or department this step belongs to. */
  role: string;
  /** Reached at or after any of these statuses. */
  reachedAtAny: readonly ModerationStatus[];
  /** Computed when the step is rendered. */
  completed: boolean;
  /** True if this is the active stage. */
  active: boolean;
}

type StepBlueprint = Omit<IModerationTimelineStep, 'completed' | 'active'> & {
  activeAt: readonly ModerationStatus[];
};

const AFTER_DEAN: readonly ModerationStatus[] = [
  ModerationStatus.PENDING_RETURN_HOME_HOD,
  ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
  ModerationStatus.PENDING_RETURN_CA,
  ModerationStatus.APPROVED_READY_TO_PUBLISH,
  ModerationStatus.PUBLISHED,
];

const INTERNAL_TIMELINE: readonly StepBlueprint[] = [
  {
    label: 'Letter submitted',
    role: 'Course Advisor',
    activeAt: [ModerationStatus.DRAFT],
    reachedAtAny: [
      ModerationStatus.PENDING_HOME_HOD,
      ModerationStatus.REJECTED_HOME_HOD,
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ...AFTER_DEAN,
    ],
  },
  {
    label: 'HOD reviews & moderates score',
    role: 'Home Department HOD',
    activeAt: [
      ModerationStatus.PENDING_HOME_HOD,
      ModerationStatus.REJECTED_HOME_HOD,
    ],
    reachedAtAny: [
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ...AFTER_DEAN,
    ],
  },
  {
    label: 'Dean approval',
    role: 'Faculty Dean',
    activeAt: [ModerationStatus.PENDING_DEAN, ModerationStatus.REJECTED_DEAN],
    reachedAtAny: AFTER_DEAN,
  },
  {
    label: 'HOD forwards to Course Advisor',
    role: 'Home Department HOD',
    activeAt: [ModerationStatus.PENDING_HOME_HOD_POST_DEAN],
    reachedAtAny: [
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Course Advisor publishes',
    role: 'Course Advisor',
    activeAt: [ModerationStatus.APPROVED_READY_TO_PUBLISH],
    reachedAtAny: [ModerationStatus.PUBLISHED],
  },
];

const CROSS_TIMELINE: readonly StepBlueprint[] = [
  {
    label: 'Letter submitted',
    role: 'Course Advisor',
    activeAt: [ModerationStatus.DRAFT],
    reachedAtAny: [
      ModerationStatus.PENDING_HOME_HOD,
      ModerationStatus.REJECTED_HOME_HOD,
      ModerationStatus.PENDING_OFFERING_HOD,
      ModerationStatus.REJECTED_OFFERING_HOD,
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ...AFTER_DEAN,
    ],
  },
  {
    label: 'Home HOD eligibility review',
    role: 'Home Department HOD',
    activeAt: [
      ModerationStatus.PENDING_HOME_HOD,
      ModerationStatus.REJECTED_HOME_HOD,
    ],
    reachedAtAny: [
      ModerationStatus.PENDING_OFFERING_HOD,
      ModerationStatus.REJECTED_OFFERING_HOD,
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ...AFTER_DEAN,
    ],
  },
  {
    label: 'Offering HOD moderates score',
    role: 'Course-owning Department HOD',
    activeAt: [
      ModerationStatus.PENDING_OFFERING_HOD,
      ModerationStatus.REJECTED_OFFERING_HOD,
    ],
    reachedAtAny: [
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ...AFTER_DEAN,
    ],
  },
  {
    label: 'Dean approval',
    role: 'Faculty Dean',
    activeAt: [ModerationStatus.PENDING_DEAN, ModerationStatus.REJECTED_DEAN],
    reachedAtAny: AFTER_DEAN,
  },
  {
    label: 'Offering HOD returns result',
    role: 'Course-owning Department HOD',
    activeAt: [ModerationStatus.PENDING_RETURN_HOME_HOD],
    reachedAtAny: [
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Home HOD forwards to Course Advisor',
    role: 'Home Department HOD',
    activeAt: [ModerationStatus.PENDING_RETURN_CA],
    reachedAtAny: [
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Course Advisor publishes',
    role: 'Course Advisor',
    activeAt: [ModerationStatus.APPROVED_READY_TO_PUBLISH],
    reachedAtAny: [ModerationStatus.PUBLISHED],
  },
];

/** Build the scope-appropriate flow timeline with completion + active flags. */
export function buildModerationTimeline(
  mod: IResultModeration
): IModerationTimelineStep[] {
  const blueprint = isCross(mod) ? CROSS_TIMELINE : INTERNAL_TIMELINE;
  return blueprint.map(({ activeAt, ...step }) => ({
    ...step,
    completed: step.reachedAtAny.includes(mod.status),
    active: activeAt.includes(mod.status),
  }));
}

// ─── Status filter helpers (used by the list page) ──────────────────────────

export type ModerationListTab =
  | 'INBOX'
  | 'IN_REVIEW'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'DRAFT'
  | 'ALL';

export function describeListTab(tab: ModerationListTab): {
  label: string;
  hint: string;
} {
  switch (tab) {
    case 'INBOX':
      return {
        label: 'My turn',
        hint: 'Requests waiting for an action from you.',
      };
    case 'IN_REVIEW':
      return {
        label: 'In review',
        hint: 'Active moderations moving through the workflow.',
      };
    case 'READY_TO_PUBLISH':
      return {
        label: 'Ready to publish',
        hint: 'All approvals are in — the Course Advisor can publish now.',
      };
    case 'PUBLISHED':
      return {
        label: 'Published',
        hint: 'Moderated results that have been published to the student record.',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        hint: 'Requests that were rejected somewhere in the chain.',
      };
    case 'DRAFT':
      return {
        label: 'Drafts',
        hint: 'Requests you started but have not yet submitted.',
      };
    case 'ALL':
      return {
        label: 'All',
        hint: 'Every request you have visibility on, regardless of state.',
      };
  }
}
