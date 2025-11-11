export interface IStudentGrade {
  _id?: string;
  registrationNumber: string;
  fullName: string;
  test: number;
  lab: number;
  exam: number;
  total: number;
  grade: string;
  status: string;
}
