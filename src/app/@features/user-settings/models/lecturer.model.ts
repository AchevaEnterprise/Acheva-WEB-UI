import { RoleEnum } from '../../auth/model/auth.model';

export interface ILecturer {
  _id: string;
  titles: string[];
  firstname: string;
  lastname: string;
  email: string;
  assignedLevelAdmissionYear: string;
  masterUserId: string | null;
  faculty: string;
  department: string;
  school: string;
  role: RoleEnum;
  accessLevel: string;
  accountType: 'LECTURER';
  assignedLevel: string;
}
