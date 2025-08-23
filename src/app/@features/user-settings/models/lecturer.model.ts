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
