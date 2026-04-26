import { RoleEnum } from '../../@features/auth/model/auth.model';

export interface ISchool {
  _id: string;
  name: string;
}

export interface IFaculty {
  _id: string;
  name: string;
  school: string;
}

export interface IDepartment {
  _id: string;
  name: string;
  faculty: string;
}

export enum LevelsEnum {
  YEAR_ONE = '100',
  YEAR_TWO = '200',
  YEAR_THREE = '300',
  YEAR_FOUR = '400',
  YEAR_FIVE = '500',
  YEAR_SIX = '600',
  EXCEPTION = 'EXCEPTION',
  REFERENCE = 'REFERENCE',
  UNREGISTERED = 'UNREGISTERED',
}

export enum SemesterEnum {
  FIRST = '1ST SEMESTER',
  SECOND = '2ND SEMESTER',
  THIRD = '3RD SEMESTER',
}

/** Result Management segment value; used by dashboard cards for deep-linking. */
export type ResultManagementDashboardTab =
  | 'DRAFT'
  | 'PENDING'
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'APPROVED'
  | 'COMPLETE'
  | 'PUBLISHED'
  | 'IMPORTED';

export interface IAnalytics {
  label: string;
  count: number;
  iconSrc: string;
  infoLabel: string;
  accessRole: RoleEnum[];
  /** When set, the dashboard card navigates to Result Management on this tab. */
  resultTab?: ResultManagementDashboardTab;
}
