import {
  IDepartment,
  IFaculty,
  ISchool,
  LevelsEnum,
} from '../../../@core/models/school.model';

export interface IStudent {
  _id: string;
  fullName: string;
  registrationNumber: string;
  faculty: IFaculty | string;
  department: IDepartment | string;
  school: ISchool | string;
  email: string;
  session: string;
  level: string;
  accountType: 'STUDENT';
  emailVerified: boolean;
}

export interface ICreateStudent {
  fullName: string;
  registrationNumber: string;
}

export interface IStudentGrade {
  _id?: string;
  registrationNumber: string;
  fullName: string;
  test: number;
  lab: number;
  exam: number;
  total: number;
  grade: string;
  status: string;
}

export interface IStudentQuery {
  school: string;
  department: string;
  level: string;
}

export interface IStudentPerformance {
  _id: string;
  courseCode: string;
  total: number;
}

export interface StudentResultType {
  _id: string;
  test: number;
  lab: number;
  exam: number;
  total: number;
  grade: string;
  status: string;
  courseLoad: number;
  courseCode: string;
}

export interface IStudentResult {
  gpa: number;
  results: StudentResultType[];
}

export interface IStudentAnalytics {
  results: number;
  departmentalDues: number;
  hasPaidDues: boolean;
}

export interface IResultEntry {
  resultId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  test: number;
  lab: number;
  exam: number;
  total: number;
  grade: string;
  status: string;
}

export interface IStudentSessionsResult {
  session: string;
  level: LevelsEnum;
  entries: IResultEntry[];
}
