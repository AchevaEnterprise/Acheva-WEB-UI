import {
  IDepartment,
  IFaculty,
  ISchool,
} from '../../../@core/models/school.model';

export interface ILogIn {
  email: string;
  password: string;
}

export enum RoleEnum {
  ALL = '',
  DEAN = 'DEAN',
  HOD = 'HOD',
  COURSE_ADVISOR = 'COURSE_ADVISOR',
  COURSE_COORDINATOR = 'COURSE_COORDINATOR',
  LECTURER = 'LECTURER',
}

export interface ISignUp {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
  faculty: string;
  department: string;
  school: string;
  title?: string | string[];
  role: RoleEnum;
}

export interface IAuthProfile {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  school: ISchool;
  faculty: IFaculty;
  department: IDepartment;
  role: RoleEnum;
  otherRoles: RoleEnum[];
  accountType: 'LECTURER';
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string;
}

export interface IAccount {
  id: string;
  firstname: string;
  lastname: string;
  middlename: string;
  school: ISchool;
  faculty: IFaculty;
  department: IDepartment;
  email: string;
  role: RoleEnum;
  otherRoles: RoleEnum[];

  // Added
  titles: string[];
  accessLevel: string;
  accountType: string;
  assignedLevel: string;
  assignedLevelAdmissionYear: string;
  masterUserId: string;
}

export interface IResetPassword {
  // token: string;
  password: string;
  confirmPassword: string;
}

export interface IAccessRefreshToken {
  accessToken: string;
  refreshToken: string;
}
