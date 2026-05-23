import {
  IDepartment,
  IFaculty,
  ISchool,
} from '../../../@core/models/school.model';
import { RoleEnum } from '../../auth/model/auth.model';
import { ICourse } from '../../courses/models/course.model';
import { IStudent } from '../../students/models/student.model';

// ─── Enums (mirror `acheva-nestjs/src/moderation/moderation.enum.ts`) ────────

export enum ModerationScope {
  INTERNAL = 'INTERNAL',
  CROSS_DEPARTMENT = 'CROSS_DEPARTMENT',
}

export enum ModerationStatus {
  DRAFT = 'DRAFT',
  PENDING_HOME_HOD = 'PENDING_HOME_HOD',
  PENDING_OFFERING_HOD = 'PENDING_OFFERING_HOD',
  PENDING_MODERATION = 'PENDING_MODERATION',
  PENDING_OFFERING_HOD_REVIEW = 'PENDING_OFFERING_HOD_REVIEW',
  PENDING_DEAN = 'PENDING_DEAN',
  PENDING_RETURN_HOME_HOD = 'PENDING_RETURN_HOME_HOD',
  PENDING_HOME_HOD_POST_DEAN = 'PENDING_HOME_HOD_POST_DEAN',
  PENDING_RETURN_CA = 'PENDING_RETURN_CA',
  APPROVED_READY_TO_PUBLISH = 'APPROVED_READY_TO_PUBLISH',
  PUBLISHED = 'PUBLISHED',
  REJECTED_HOME_HOD = 'REJECTED_HOME_HOD',
  REJECTED_OFFERING_HOD = 'REJECTED_OFFERING_HOD',
  REJECTED_DEAN = 'REJECTED_DEAN',
  CANCELLED = 'CANCELLED',
}

export enum ModerationAction {
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

// ─── Lightweight populated shapes ─────────────────────────────────────────────

export interface IModerationLecturer {
  _id: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
  email?: string;
  role?: RoleEnum;
  accessLevel?: string;
  department?: string | IDepartment;
  faculty?: string | IFaculty;
  assignedLevel?: string;
}

// ─── Outcome / attachments / history ─────────────────────────────────────────

export interface IModerationOutcome {
  test: number;
  lab: number;
  exam: number;
  total: number;
  grade: string;
  status: 'PASS' | 'FAIL';
  submittedAt: string | Date;
}

export interface IModerationAttachment {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  description?: string | null;
  uploadedAt: string | Date;
}

export interface IModerationHistoryEntry {
  action: ModerationAction;
  /** Server stores ObjectId. Detail/list endpoints do not populate this field. */
  lecturer: string;
  lecturerRole: RoleEnum;
  timestamp: string | Date;
  comment?: string | null;
}

// ─── Standalone comment ──────────────────────────────────────────────────────

export interface IModerationComment {
  _id: string;
  moderation: string;
  /** Populated by the API with first/middle/last name + role + dept + faculty. */
  lecturer:
    | string
    | {
        _id: string;
        firstname?: string;
        middlename?: string;
        lastname?: string;
        accessLevel?: string;
        department?: string | { _id: string; name: string };
        faculty?: string | { _id: string; name: string };
      };
  role: RoleEnum;
  comment: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ─── Resource ───────────────────────────────────────────────────────────────

/**
 * Shape returned by `GET /moderations/:id` (full detail).
 *
 * Many fields are populated by the backend using a single
 * `.populate('student course homeDepartment ...')` call. The list endpoint
 * populates a subset — references are typed as union with raw id strings so
 * both responses are typeable without casts at every call site.
 */
export interface IResultModeration {
  _id: string;
  moderationScope: ModerationScope;
  status: ModerationStatus;

  student: string | IStudent;
  course: string | ICourse;

  session: string;
  level: string;
  semester: string;

  homeDepartment: string | IDepartment;
  homeFaculty: string | IFaculty;
  offeringDepartment: string | IDepartment | null;
  offeringFaculty: string | IFaculty | null;
  school: string | ISchool;

  submittedBy: string | IModerationLecturer;
  currentHandler: string | IModerationLecturer | null;
  assignedModerator: string | IModerationLecturer | null;
  preferredModeratorNote?: string | null;

  letterBody: string;
  attachments: IModerationAttachment[];
  workflowHistory: IModerationHistoryEntry[];
  moderationOutcome: IModerationOutcome | null;
  linkedResult?: string | null;
  rejectionReason?: string | null;

  createdAt: string | Date;
  updatedAt: string | Date;
}

// ─── Paginated list ──────────────────────────────────────────────────────────

export interface IModerationListPage {
  total: number;
  page: number;
  limit: number;
  data: IResultModeration[];
}

// ─── Request payloads ────────────────────────────────────────────────────────

export interface ICreateModerationPayload {
  student: string;
  course: string;
  session: string;
  level: string;
  semester: string;
  letterBody: string;
  /** When true the API skips `DRAFT` and submits to the home HOD immediately. */
  submitImmediately?: boolean;
}

export interface IListModerationsQuery {
  status?: ModerationStatus | string;
  moderationScope?: ModerationScope;
  studentId?: string;
  departmentId?: string;
  pendingForMe?: boolean;
  page?: number;
  limit?: number;
}

/** Body of `PATCH /moderations/:id/home-hod/approve-internal` and `/offering-hod/approve`. */
export interface IAssignModeratorPayload {
  assignedLecturerId: string;
  preferredModeratorNote?: string;
  comment?: string;
}

/** Body of any rejection endpoint. */
export interface IRejectPayload {
  reason: string;
  comment?: string;
}

/** Body of `PATCH /moderations/:id/moderator/submit`. */
export interface ISubmitOutcomePayload {
  test: number;
  lab?: number;
  exam: number;
  comment?: string;
}

/** Body of approval / forward endpoints that only accept an optional comment. */
export interface IWithCommentPayload {
  comment?: string;
}

/** Body of `POST /moderations/:id/attachments`. */
export interface IAddAttachmentPayload {
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  description?: string;
}
