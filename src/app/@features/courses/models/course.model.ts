import {
  IDepartment,
  IFaculty,
  ISchool,
  LevelsEnum,
  SemesterEnum,
} from '../../../@core/models/school.model';

export interface ICourse {
  _id?: string;
  session?: string;
  semester: string;
  courseTitle: string;
  courseCode: string;
  faculty: IFaculty;
  department: IDepartment;
  school: ISchool;
  level: string;
  courseCordinator?: string;
  courseLoad: number;
  lecturer: string;
  assignedTo?: {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
    department: string;
    role: string;
  };
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
  level: LevelsEnum;
  semester: SemesterEnum | string;
}

export interface ICourseTemplate {
  id: string;
  course_title: string;
  course_code: string;
  course_cordinator: string;
  course_unit: number;
  semester: string;
  session: string;
  level: string;
  faculty: IFaculty;
  department: IDepartment;
  date_created: Date;
}
