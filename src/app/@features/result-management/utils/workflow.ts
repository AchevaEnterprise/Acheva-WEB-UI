import { RoleEnum } from '../../auth/model/auth.model';
import { IResult, ResultStatusEnum } from '../models/results.model';

/**
 * Mirrors the authoritative backend workflow defined in:
 *   - `acheva-nestjs/src/results/services/results.service.ts`  (approve/reject)
 *   - `acheva-nestjs/src/common/utils/statusChecker.ts`         (allowed statuses)
 *
 * Trunk:
 *   LECTURER → COURSE_COORDINATOR → HOD (course dept, 1st pass) → DEAN
 *            → HOD (course dept, 2nd pass)
 *            → [HOD (offering dept) — external cohort only]
 *            → COURSE_ADVISOR → (publish)
 *
 * Status progression:
 *   Internal cohort:
 *     DRAFT → PENDING → UNVERIFIED → VERIFIED → COMPLETE → PUBLISHED
 *   External cohort:
 *     DRAFT → PENDING → UNVERIFIED → VERIFIED → APPROVED → COMPLETE → PUBLISHED
 *
 * APPROVED is an external-cohort-only transient (course-dept HOD → offering-dept
 * HOD). COMPLETE is the single pre-publish terminal state on both paths.
 */

/**
 * Human-friendly labels for each role when displayed as a recipient
 * (e.g. in confirmation dialogs: "send to the Course Coordinator").
 */
export const RECIPIENT_LABELS: Record<RoleEnum, string> = {
  [RoleEnum.ALL]: 'recipient',
  [RoleEnum.LECTURER]: 'Lecturer',
  [RoleEnum.COURSE_COORDINATOR]: 'Course Coordinator',
  [RoleEnum.HOD]: 'Head of Department',
  [RoleEnum.DEAN]: 'Dean',
  [RoleEnum.COURSE_ADVISOR]: 'Course Advisor',
};

/** Ordered list of terminal-facing statuses for progress comparisons. */
export const RESULT_STATUS_ORDER: readonly ResultStatusEnum[] = [
  ResultStatusEnum.DRAFT,
  ResultStatusEnum.PENDING,
  ResultStatusEnum.UNVERIFIED,
  ResultStatusEnum.VERIFIED,
  ResultStatusEnum.APPROVED,
  ResultStatusEnum.COMPLETE,
  ResultStatusEnum.PUBLISHED,
];

/** Returns true if `a` comes at or after `b` in the workflow. */
export function isStatusAtLeast(
  a: ResultStatusEnum,
  b: ResultStatusEnum
): boolean {
  return RESULT_STATUS_ORDER.indexOf(a) >= RESULT_STATUS_ORDER.indexOf(b);
}

/**
 * Internal cohort = students wrote a course owned by their own department
 * (e.g. Mathematics 100L sitting `MTH 101`). External cohort = otherwise
 * (e.g. Physics 100L sitting `MTH 101`), which adds an extra HOD hop before
 * the Course Advisor.
 */
export function isInternalCohort(result: IResult): boolean {
  const cohortDeptId = result.department?._id;
  const courseDeptId = result.course?.department?._id;
  if (!cohortDeptId || !courseDeptId) return false;
  return String(cohortDeptId) === String(courseDeptId);
}

export interface IHandoff {
  /** Role of the recipient — what to pass as `?role=` on the send endpoint. */
  role: RoleEnum;
  /** Lecturer id to send the result to. */
  recipientId: string;
}

/**
 * Who receives the result when the current user approves it.
 * Returns `null` when the user cannot forward from the current state.
 */
export function getApprovalHandoff(
  result: IResult,
  currentUserRole: RoleEnum
): IHandoff | null {
  const { roles, status } = result;

  switch (currentUserRole) {
    case RoleEnum.LECTURER:
      // Lecturer → Course Coordinator (initial handoff out of DRAFT).
      if (status !== ResultStatusEnum.DRAFT) return null;
      return toHandoff(RoleEnum.COURSE_COORDINATOR, roles.COURSE_COORDINATOR);

    case RoleEnum.COURSE_COORDINATOR:
      // CC approves DRAFT → PENDING, forwards to course-dept HOD (1st pass).
      return toHandoff(RoleEnum.HOD, roles.HOD_COURSE_DEPT);

    case RoleEnum.HOD: {
      if (status === ResultStatusEnum.PENDING) {
        // 1st pass: PENDING → UNVERIFIED, forward to the Dean.
        return toHandoff(RoleEnum.DEAN, roles.DEAN);
      }
      if (status === ResultStatusEnum.VERIFIED) {
        // 2nd pass (course-dept HOD).
        //   Internal cohort: VERIFIED → COMPLETE, straight to the Course Advisor.
        //   External cohort: VERIFIED → APPROVED, hop through offering-dept HOD.
        if (isInternalCohort(result)) {
          return toHandoff(RoleEnum.COURSE_ADVISOR, roles.COURSE_ADVISOR);
        }
        return toHandoff(RoleEnum.HOD, roles.HOD_OFFERING_DEPT);
      }
      if (status === ResultStatusEnum.APPROVED) {
        // Offering-dept HOD (external only): APPROVED → COMPLETE → CA.
        return toHandoff(RoleEnum.COURSE_ADVISOR, roles.COURSE_ADVISOR);
      }
      return null;
    }

    case RoleEnum.DEAN:
      // Dean approves UNVERIFIED → VERIFIED, returns to course-dept HOD.
      return toHandoff(RoleEnum.HOD, roles.HOD_COURSE_DEPT);

    case RoleEnum.COURSE_ADVISOR:
      // CA does not forward; they publish.
      return null;

    default:
      return null;
  }
}

/**
 * Who receives the result when the current user rejects it.
 * Mirrors `ResultsService.rejectResult` in the Nest API.
 */
export function getRejectionHandoff(
  result: IResult,
  currentUserRole: RoleEnum
): IHandoff | null {
  const { roles, uploadedBy } = result;
  const uploadedById =
    typeof uploadedBy === 'string' ? uploadedBy : uploadedBy?._id;

  switch (currentUserRole) {
    case RoleEnum.COURSE_COORDINATOR:
      // CC rejects → back to the uploading lecturer (status DRAFT, unsent).
      return uploadedById
        ? { role: RoleEnum.LECTURER, recipientId: uploadedById }
        : null;

    case RoleEnum.HOD:
      // HOD (1st pass) rejects → back to the Course Coordinator.
      // Backend forbids HOD rejection after VERIFIED/APPROVED/COMPLETE.
      return toHandoff(RoleEnum.COURSE_COORDINATOR, roles.COURSE_COORDINATOR);

    case RoleEnum.DEAN:
      // Dean rejects → back to the course-dept HOD (status PENDING).
      return toHandoff(RoleEnum.HOD, roles.HOD_COURSE_DEPT);

    default:
      return null;
  }
}

/**
 * CA may publish only the results that have cleared the full HOD chain.
 * COMPLETE is the single pre-publish terminal state for both cohorts.
 */
export function canPublish(result: IResult): boolean {
  return result.status === ResultStatusEnum.COMPLETE;
}

/** Reject availability rules (kept in sync with the backend guard). */
export function canReject(result: IResult, role: RoleEnum): boolean {
  if (role === RoleEnum.COURSE_ADVISOR) return false;
  if (role === RoleEnum.HOD) {
    return (
      result.status !== ResultStatusEnum.VERIFIED &&
      result.status !== ResultStatusEnum.APPROVED &&
      result.status !== ResultStatusEnum.COMPLETE
    );
  }
  return true;
}

function toHandoff(
  role: RoleEnum,
  recipientId: string | null
): IHandoff | null {
  return recipientId ? { role, recipientId } : null;
}

/**
 * Whether a result is read-only for the lecturer who uploaded it.
 *
 * A lecturer may edit a result only while it is a draft still in their custody
 * and not yet sent. Once forwarded to the Course Coordinator it flips
 * `hasBeenSent` and becomes read-only — including the "second draft" that stays
 * in DRAFT status. Rejections route the result back down the chain (HOD → CC →
 * lecturer); the CC's rejection resets `hasBeenSent` to false when the result
 * finally returns to the lecturer, making it editable again.
 */
export function isResultReadonlyForLecturer(
  result: Pick<IResult, 'status' | 'hasBeenSent'> | null | undefined
): boolean {
  if (!result) return false;
  return result.status !== ResultStatusEnum.DRAFT || !!result.hasBeenSent;
}
