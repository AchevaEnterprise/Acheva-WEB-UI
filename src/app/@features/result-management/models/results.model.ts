export enum ResultStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IResult {
  session: string;
  level: string;
  semester: string;
  department: string;
  school: string;
  status: ResultStatusEnum;
  uploadedBy: string;
  isApproved: boolean;
  comments: any[];
  createdAt: Date;
  updatedAt: Date;
  course: any;
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
  category: string;
  fullName: string;
  limit: string;
}
