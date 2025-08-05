export interface ICourse {
  semester: string;
  courseTitle: string;
  courseCode: string;
  faculty: string;
  department: string;
  school: string;
  level: string;
  courseLoad: number;
  lecturer: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateCourse {
  semester: string;
  courseTitle: string;
  courseLoad: number;
  courseCode: string;
  faculty: string;
  department: string;
  level: string;
}

export interface ICourseQuery {
  courseCode: string;
  courseTitle: string;
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
