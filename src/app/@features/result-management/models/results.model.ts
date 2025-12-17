import {
  IDepartment,
  IFaculty,
  ISchool,
} from '../../../@core/models/school.model';
import { RoleEnum } from '../../auth/model/auth.model';
import { ICourse } from '../../courses/models/course.model';

export type SegmentValue = 'REGULAR' | 'REFERENCE' | 'UNREGISTERED';

export enum ResultStatusEnum {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
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
  uploadedBy: string;
  isApproved: boolean;
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
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
  };
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
  status: ResultStatusEnum;
}

export interface IResultQuery {
  status: string;
  course: string;
  hasBeenSent: boolean;
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
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

type ResultStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'UNVERIFIED'
  | 'VERIFIED'
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
