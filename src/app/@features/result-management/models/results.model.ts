import { IDepartment, ISchool } from '../../../@core/models/school.model';
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
}

export interface ICreateResult {
  course: string;
  department: string;
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
  recepient: string;
}
