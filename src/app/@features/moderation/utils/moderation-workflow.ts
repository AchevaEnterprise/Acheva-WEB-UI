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
 * Two flows depending on the moderation scope:
 *   INTERNAL:
 *     CA → Home HOD → Assigned Lecturer → Home HOD review → Dean
 *        → Home HOD (post-dean) → CA (publish)
 *
 *   CROSS_DEPARTMENT:
 *     CA → Home HOD → Offering HOD → Assigned Lecturer
 *        → Offering HOD review → Dean → Offering HOD (return)
 *        → Home HOD (return) → CA (publish)
 *
 * The backend tracks the active step on `currentHandler` — UI gating below
 * always starts from "is the current user the current handler?".
 */

// ─── Status grouping & labels ───────────────────────────────────────────────

export const MODERATION_PENDING_STATUSES: readonly ModerationStatus[] = [
  ModerationStatus.PENDING_HOME_HOD,
  ModerationStatus.PENDING_OFFERING_HOD,
  ModerationStatus.PENDING_MODERATION,
  ModerationStatus.PENDING_OFFERING_HOD_REVIEW,
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
  [ModerationStatus.PENDING_MODERATION]: 'Awaiting Moderator',
  [ModerationStatus.PENDING_OFFERING_HOD_REVIEW]: 'Awaiting HOD Review',
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

export function isAssignedModerator(
  mod: IResultModeration,
  lecturerId: string | undefined
): boolean {
  if (!lecturerId) return false;
  return refId(mod.assignedModerator) === lecturerId;
}

/**
 * For HODs we additionally need to know which department(s) they own —
 * `currentHandler` already tells us *if* they should act, but `homeDept` vs
 * `offeringDept` decides *which set of buttons* (cross-approval vs. internal).
 */
export function lecturerDeptId(
  lecturer: Pick<IModerationLecturer, 'department'> | undefined | null
): string {
  if (!lecturer) return '';
  return refId(lecturer.department as never);
}

// ─── Action descriptors used by the UI ──────────────────────────────────────

/**
 * Each action represents a button the current user may click on a moderation
 * detail page. Pages compose the list by feeding the moderation, the user,
 * and the user's role through {@link getAvailableActions}.
 *
 * Tone:
 *   primary    — main forward step (approve, submit, publish, …)
 *   destructive — reject / cancel
 *   secondary  — neutral (forward, return)
 */
export type ModerationActionTone = 'primary' | 'destructive' | 'secondary';

export type ModerationActionKind =
  // CA
  | 'submit'
  | 'cancel'
  | 'publish'
  // Home HOD
  | 'homeHodApproveInternal'
  | 'homeHodApproveCross'
  | 'homeHodReject'
  | 'homeHodForwardToCa'
  // Offering HOD (cross only)
  | 'offeringHodApprove'
  | 'offeringHodReject'
  | 'offeringHodForwardAfterDean'
  // HOD review (after moderator submits)
  | 'hodForwardToDean'
  // Moderator
  | 'moderatorSubmit'
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
   * `assign-moderator` opens the lecturer picker, `reject` opens the reason
   * dialog, `score` opens the moderator outcome form, `confirm` is a yes/no.
   */
  flow: 'confirm' | 'assign-moderator' | 'reject' | 'score';
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
            'Approve and route this request to the HOD of the course-owning department.',
          flow: 'confirm',
        });
      } else {
        actions.push({
          kind: 'homeHodApproveInternal',
          label: 'Assign moderator',
          tone: 'primary',
          description:
            'Approve and assign a lecturer in your department to moderate this result.',
          flow: 'assign-moderator',
        });
      }
      actions.push(reject('homeHodReject', 'Reject to Course Advisor'));
      return actions;
    }

    case ModerationStatus.PENDING_OFFERING_HOD: {
      actions.push({
        kind: 'offeringHodApprove',
        label: 'Assign moderator',
        tone: 'primary',
        description:
          'Approve and assign a lecturer in this department to moderate the result.',
        flow: 'assign-moderator',
      });
      actions.push(reject('offeringHodReject', 'Reject to Course Advisor'));
      return actions;
    }

    case ModerationStatus.PENDING_MODERATION: {
      actions.push({
        kind: 'moderatorSubmit',
        label: 'Submit moderated scores',
        tone: 'primary',
        description:
          'Enter the test, lab and exam scores for the student and submit for HOD review.',
        flow: 'score',
      });
      return actions;
    }

    case ModerationStatus.PENDING_OFFERING_HOD_REVIEW: {
      actions.push({
        kind: 'hodForwardToDean',
        label: 'Forward to Dean',
        tone: 'primary',
        description:
          'Forward the moderated outcome to the Dean of the relevant faculty for approval.',
        flow: 'confirm',
      });
      return actions;
    }

    case ModerationStatus.PENDING_DEAN: {
      actions.push({
        kind: 'deanApprove',
        label: 'Approve',
        tone: 'primary',
        description:
          'Approve the moderated result; it returns to the originating HOD chain.',
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
      'Publish the moderated score so it appears in the student record.',
    flow: 'confirm',
  };
}

function reject(kind: ModerationActionKind, label: string): IModerationAction {
  return {
    kind,
    label,
    tone: 'destructive',
    description:
      'Capture a reason and return the request to the previous stage.',
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

const TIMELINE_BLUEPRINT: readonly Omit<
  IModerationTimelineStep,
  'completed' | 'active'
>[] = [
  {
    label: 'Submitted',
    role: 'Course Advisor',
    reachedAtAny: [
      ModerationStatus.PENDING_HOME_HOD,
      ModerationStatus.REJECTED_HOME_HOD,
      ModerationStatus.PENDING_OFFERING_HOD,
      ModerationStatus.REJECTED_OFFERING_HOD,
      ModerationStatus.PENDING_MODERATION,
      ModerationStatus.PENDING_OFFERING_HOD_REVIEW,
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ModerationStatus.PENDING_RETURN_HOME_HOD,
      ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Home HOD review',
    role: 'Home Department',
    reachedAtAny: [
      ModerationStatus.PENDING_OFFERING_HOD,
      ModerationStatus.PENDING_MODERATION,
      ModerationStatus.PENDING_OFFERING_HOD_REVIEW,
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ModerationStatus.PENDING_RETURN_HOME_HOD,
      ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Offering HOD assigns moderator',
    role: 'Course-owning Department',
    reachedAtAny: [
      ModerationStatus.PENDING_MODERATION,
      ModerationStatus.PENDING_OFFERING_HOD_REVIEW,
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ModerationStatus.PENDING_RETURN_HOME_HOD,
      ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Lecturer moderation',
    role: 'Assigned Moderator',
    reachedAtAny: [
      ModerationStatus.PENDING_OFFERING_HOD_REVIEW,
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ModerationStatus.PENDING_RETURN_HOME_HOD,
      ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'HOD review',
    role: 'Reviewing HOD',
    reachedAtAny: [
      ModerationStatus.PENDING_DEAN,
      ModerationStatus.REJECTED_DEAN,
      ModerationStatus.PENDING_RETURN_HOME_HOD,
      ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Dean approval',
    role: 'Faculty Dean',
    reachedAtAny: [
      ModerationStatus.PENDING_RETURN_HOME_HOD,
      ModerationStatus.PENDING_HOME_HOD_POST_DEAN,
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Return to home HOD',
    role: 'Home Department',
    reachedAtAny: [
      ModerationStatus.PENDING_RETURN_CA,
      ModerationStatus.APPROVED_READY_TO_PUBLISH,
      ModerationStatus.PUBLISHED,
    ],
  },
  {
    label: 'Course Advisor publishes',
    role: 'Course Advisor',
    reachedAtAny: [ModerationStatus.PUBLISHED],
  },
];

/**
 * Build a flow timeline with completion + active flags. Cross-department-only
 * steps (offering-HOD assignment, return-to-home-HOD) are filtered out for
 * INTERNAL scope so the UI only shows the path the result actually takes.
 */
export function buildModerationTimeline(
  mod: IResultModeration
): IModerationTimelineStep[] {
  const internal = !isCross(mod);

  return TIMELINE_BLUEPRINT.filter((step, index) => {
    if (!internal) return true;

    // Step 2 = "Offering HOD assigns moderator" — internal-only flow uses the
    // home HOD for that step; we collapse it into "Home HOD review".
    // Step 6 = "Return to home HOD" — only happens cross-dept after the dean.
    return index !== 2 && index !== 6;
  }).map((step) => ({
    ...step,
    completed: step.reachedAtAny.includes(mod.status),
    active: isStepActive(step.label, mod.status, internal),
  }));
}

function isStepActive(
  label: string,
  status: ModerationStatus,
  internal: boolean
): boolean {
  switch (label) {
    case 'Submitted':
      return status === ModerationStatus.DRAFT;
    case 'Home HOD review':
      return (
        status === ModerationStatus.PENDING_HOME_HOD ||
        status === ModerationStatus.REJECTED_HOME_HOD ||
        status === ModerationStatus.PENDING_HOME_HOD_POST_DEAN ||
        (internal && status === ModerationStatus.PENDING_OFFERING_HOD_REVIEW)
      );
    case 'Offering HOD assigns moderator':
      return (
        status === ModerationStatus.PENDING_OFFERING_HOD ||
        status === ModerationStatus.REJECTED_OFFERING_HOD
      );
    case 'Lecturer moderation':
      return status === ModerationStatus.PENDING_MODERATION;
    case 'HOD review':
      return (
        !internal && status === ModerationStatus.PENDING_OFFERING_HOD_REVIEW
      );
    case 'Dean approval':
      return (
        status === ModerationStatus.PENDING_DEAN ||
        status === ModerationStatus.REJECTED_DEAN
      );
    case 'Return to home HOD':
      return status === ModerationStatus.PENDING_RETURN_HOME_HOD;
    case 'Course Advisor publishes':
      return (
        status === ModerationStatus.PENDING_RETURN_CA ||
        status === ModerationStatus.APPROVED_READY_TO_PUBLISH
      );
    default:
      return false;
  }
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
