import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IAPIPaginatedResponse,
  IAPIResponse,
} from '../../../@core/models/api-response.model';
import { ICourse, ICourseQuery, ICreateCourse } from '../models/course.model';

@Injectable({
  providedIn: 'root',
})
export class CoursesService {
  private readonly http = inject(HttpClient);
  private readonly coursesUrl = `${environment.BASE_URL}/courses`;

  getCourses(
    query?: Partial<ICourseQuery>
  ): Observable<IAPIPaginatedResponse<ICourse[]>> {
    let params = new HttpParams();

    if (query) {
      if (query.courseCode)
        params = params.append('courseCode', query.courseCode);
      if (query.courseTitle)
        params = params.append('courseTitle', query.courseTitle);
      if (query.level) params = params.append('level', query.level);
    }

    return this.http.get<IAPIPaginatedResponse<ICourse[]>>(
      `${this.coursesUrl}`,
      {
        params,
      }
    );
  }

  getCourse(courseId: string): Observable<IAPIResponse<ICourse>> {
    return this.http.get<IAPIResponse<ICourse>>(
      `${this.coursesUrl}/${courseId}`
    );
  }

  getRecentCourses(): Observable<IAPIResponse<ICourse[]>> {
    return this.http.get<IAPIResponse<ICourse[]>>(
      `${this.coursesUrl}/recently-used`
    );
  }

  createCourse(course: ICreateCourse): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(`${this.coursesUrl}`, course);
  }

  updateCourse(
    courseId: string,
    course: Partial<ICreateCourse>
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.coursesUrl}/${courseId}`,
      course
    );
  }

  assignCourseToLecturer(
    courseId: string,
    lecturerId: string
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.coursesUrl}/${courseId}/assign`,
      { lecturer: lecturerId, action: 'ASSIGN' }
    );
  }

  unassignCourseFromLecturer(
    courseId: string,
    lecturerId: string
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.coursesUrl}/${courseId}/assign`,
      { lecturer: lecturerId, action: 'UNASSIGN' }
    );
  }
}
