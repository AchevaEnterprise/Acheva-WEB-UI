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
  title: string | string[];
  role: RoleEnum;
}

export interface IAuthProfile {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  faculty: string;
  department: string;
  role: RoleEnum;
  accountType: 'LECTURER';
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string;
}

export interface IAccount {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: RoleEnum;
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
