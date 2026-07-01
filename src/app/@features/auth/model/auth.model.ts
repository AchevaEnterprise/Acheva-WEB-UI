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
  firstname: string | null;
  lastname: string | null;
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
  middlename?: string;
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
  assignedLevel?: string | null;
  assignedLevelAdmissionYear?: string | null;
}

export interface IAccount
  extends Omit<IAuthProfile, 'accessToken' | 'refreshToken'> {
  middlename: string;
  titles: string[];
  accessLevel: string;
  assignedLevel: string | null;
  assignedLevelAdmissionYear: string | null;
  masterUserId: string;
}

export interface IResetPassword {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface IAccessRefreshToken {
  accessToken: string;
  refreshToken: string;
}
