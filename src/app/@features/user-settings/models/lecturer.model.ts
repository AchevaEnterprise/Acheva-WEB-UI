export interface ILecturer {
  _id: string;
  titles: string[];
  firstname: string;
  masterUserId: string;
  lastname: string;
  email: string;
  faculty: string;
  department: string;
  school: string;
  role: string;
  accountType: 'LECTURER';
}

export interface LecturerAssignment {
  _id: string;
  titles: string[];
  firstname: string;
  lastname: string;
  lastModified?: string;
  isActive?: boolean;
  email: string;
  masterUserId: string | null;
  faculty: string;
  department: string;
  school: string;
  role: 'HOD' | 'LECTURER' | 'DEAN' | string;
  accountType: 'LECTURER' | 'ADMIN' | string;
  assignedLevel: 'NONE' | '100' | '200' | '300' | '400' | '500' | string;
}
