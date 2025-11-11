export interface IStudent {
  _id: string;
  fullName: string;
  registrationNumber: string;
  faculty: string;
  department: string;
  school: string;
  email: string;
  session: string;
  level: string;
  accountType: 'STUDENT';
  emailVerified: boolean;
}
