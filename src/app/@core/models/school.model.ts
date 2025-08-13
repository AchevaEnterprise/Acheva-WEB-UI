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
}

export enum SemesterEnum {
  FIRST = '1ST SEMESTER',
  SECOND = '2ND SEMESTER',
  THIRD = '3RD SEMESTER',
}
