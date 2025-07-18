export interface ICourse {
  courseCode: string;
  courseTitle: string;
  session: string;
  department: string;
  faculty: string;
  uploadedDate: Date;
  sentDate: Date;
  modifiedDate: Date;
}

export interface ICourseTemplate {
  course_title: string;
  course_code: string;
  course_cordinator: string;
  course_unit: number;
  semester: string;
  session: string;
  level: string;
  faculty: string;
  department: string;
  date_created: Date;
}
