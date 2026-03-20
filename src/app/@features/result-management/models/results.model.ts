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

export interface IResult {
  _id: string;
  course: ICourse;
  session: string;
  level: string;
  semester: string;
  department: IDepartment;
  school: ISchool;
  status: ResultStatusEnum;
  uploadedBy: string | { _id: string; firstname: string; lastname: string };
  isApproved: boolean | null;
  roles: {
    COURSE_ADVISOR: string;
    COURSE_COORDINATOR: string;
    DEAN: string;
    HOD: string;
  };
  hasBeenSent: boolean;
  hasFinalApproval: boolean;
  currentHandler: string;
  lastAction: string;
  previousAction: string;
  workflowHistory: Array<unknown>;
  receivingHandler: string;
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
