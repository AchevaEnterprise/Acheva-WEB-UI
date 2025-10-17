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
  department: IDepartment | any; // Allow flexible department structure
  school: ISchool | any;
  status: ResultStatusEnum;
  uploadedBy: string;
  isApproved: boolean;
  comments: any[];
  createdAt: Date | string; // Allow string dates from localStorage
  updatedAt: Date | string; // Allow string dates from localStorage
  course: ICourse | any;
  // Additional fields for comprehensive data
  lecturer?: string;
  faculty?: string;
  createdBy?: {
    fullName: string;
  } | string; // Allow flexible structure
  // Draft-specific properties
  isDraft?: boolean;
  studentCount?: number;
  studentsWithGrades?: number;
  completionPercentage?: number;
  courseDetails?: {
    courseTitle: string;
    session: string;
    level: string;
    units: number;
  };
  segments?: string[];
  timestamp?: string;
  lastModified?: string;
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
