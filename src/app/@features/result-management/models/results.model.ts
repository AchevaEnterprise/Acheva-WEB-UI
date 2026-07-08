import {
  IDepartment,
  IFaculty,
  ISchool,
} from '../../../@core/models/school.model';
import { ISegmentSwitcher } from '../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../auth/model/auth.model';
import { ICourse } from '../../courses/models/course.model';

export type SegmentValue = 'REGULAR' | 'REFERENCE' | 'UNREGISTERED';

/**
 * Mirrors backend `ResultStatus` in `acheva-nestjs/src/results/results.enum.ts`.
 */
export enum ResultStatusEnum {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  APPROVED = 'APPROVED',
  COMPLETE = 'COMPLETE',
  PUBLISHED = 'PUBLISHED',
  IMPORTED = 'IMPORTED',
}

export const RESULT_STATUS_VALUES: ResultStatusEnum[] =
  Object.values(ResultStatusEnum);

export function isResultStatus(value: string): value is ResultStatusEnum {
  return RESULT_STATUS_VALUES.includes(value as ResultStatusEnum);
}

/**
 * Role IDs attached to every result by the backend
 * (see `ResultsService.attachRolesToResult` in the Nest API).
 *
 * The HOD field is split in two because a single result may route through
 * both the course-owning department and the students' (offering) department:
 *
 *   HOD_COURSE_DEPT   — HOD of the department that OWNS the course
 *                        (e.g. Mathematics for `MTH 101`)
 *   HOD_OFFERING_DEPT — HOD of the department whose students wrote the course
 *                        (e.g. Physics when Physics 100L sits `MTH 101`)
 *
 * When the cohort is internal (course dept === offering dept) both IDs point
 * to the same lecturer.
 */
export interface IResultRoles {
  HOD_COURSE_DEPT: string | null;
  HOD_OFFERING_DEPT: string | null;
  DEAN: string | null;
  COURSE_COORDINATOR: string;
  COURSE_ADVISOR: string | null;
}

/**
 * What the requesting user may see of a result's entries (computed by the
 * backend per request). RESTRICTED = the viewer's only link to the result is
 * being a secondary Course Advisor attached at publish time (reference-student
 * cohort CA and/or the UNREGISTERED-level CA) — they see only the listed
 * category tabs, read-only, with REFERENCE filtered to their own students.
 */
export interface IResultViewerScope {
  access: 'FULL' | 'RESTRICTED';
  categories: SegmentValue[];
}

export interface IResult {
  _id: string;
  course: ICourse;
  session: string;
  level: string;
  semester: string;
  department: IDepartment;
  faculty?: IFaculty;
  school: ISchool;
  status: ResultStatusEnum;
  uploadedBy: string | { _id: string; firstname: string; lastname: string };
  isApproved: boolean | null;
  roles: IResultRoles;
  hasBeenSent: boolean;
  hasFinalApproval: boolean;
  currentHandler: string;
  lastAction: string;
  previousAction: string;
  workflowHistory: Array<unknown>;
  receivingHandler: string;
  rejectedBy?: string[];
  analytics: {
    total: number;
    totalPass: number;
    totalFail: number;
    averageTotal: number;
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
  };
  students?: number;
  progress?: number;
  updatedAt?: Date;
  viewerScope?: IResultViewerScope;
}

export interface IGroupedResult {
  course: string;
  courseCode: string;
  courseTitle: string;
  courseLoad: number;
  session: string;
  faculty: IFaculty;
  semester: string;
  results: IResult[];
  totalResults: number;
  approvedCount: number;
  finalApprovalCount: number;
}

export interface ICreateResult {
  course: string;
  department: string;
  faculty: string;
  session: string;
  level: string;
  semester: string;
  admissionYear: string;
  school: string;
  /** Defaults to DRAFT on the server when omitted. */
  status?: ResultStatusEnum;
}

export interface IResultQuery {
  status: string;
  course: string;
  hasBeenSent: boolean;
  faculty: string;
  department: string;
}

export interface IPreparedResultQuery {
  courseId: string;
  status: string;
  session: string;
}

export interface ICreateResultEntry {
  registrationNumber: string;
  fullName: string;
  test: number;
  lab: number;
  exam: number;
  total: number;
  result: string;
  category?: ISegmentSwitcher['value'];
}

export interface IUpdateResultEntry extends ICreateResultEntry {
  _id: string;
  lecturer: string;
}

export interface IResultEntriesQuery {
  category?: string;
  fullName?: string;
  limit?: string;
}

export interface ISendSelectedResult {
  resultId: string;
  recipient: string;
}

export interface IResultComment {
  _id: string;
  result: string;
  lecturer: {
    _id: string;
    firstname: string;
    lastname: string;
    role: RoleEnum;
    accessLevel: string;
  };
  role: RoleEnum;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

type ResultStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'APPROVED'
  | 'COMPLETE'
  | 'PUBLISHED'
  | 'IMPORTED';

export interface IResultStatusCount {
  role: RoleEnum;
  allowedStatuses: ResultStatus[];
  statusCounts: {
    DRAFT: number;
    PENDING: number;
    UNVERIFIED: number;
    VERIFIED: number;
    APPROVED: number;
    COMPLETE: number;
    PUBLISHED: number;
    IMPORTED: number;
  };
  summary: {
    total: number;
    pendingAction: number;
    currentlyWithMe: number;
    sentByMe: number;
  };
}
