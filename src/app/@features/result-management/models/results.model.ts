import { IDepartment, ISchool } from '../../../@core/models/school.model';
import { ICourse } from '../../courses/models/course.model';

export enum ResultStatusEnum {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IResult {
  _id?: string;
  session: string;
  level: string;
  semester: string;
  department: IDepartment;
  school: ISchool;
  status: ResultStatusEnum;
  uploadedBy: string;
  isApproved: boolean;
  comments: any[];
  createdAt: Date;
  updatedAt: Date;
  course: ICourse;
}

export interface ICreateResult {
  course: string;
  department: string;
  session: string;
  level: string;
  semester: string;
  school: string;
  status: ResultStatusEnum;
}

export interface IResultQuery {
  status: string;
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
