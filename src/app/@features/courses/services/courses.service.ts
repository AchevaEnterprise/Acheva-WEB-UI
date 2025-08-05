import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import { ICourseQuery, ICreateCourse } from '../models/course.model';

@Injectable({
  providedIn: 'root',
})
export class CoursesService {
  private readonly http = inject(HttpClient);
  private readonly coursesUrl = `${environment.BASE_URL}/courses`;

  getCourses(query?: ICourseQuery): Observable<IAPIResponse<any>> {
    let params = new HttpParams();
    params = params.append('courseCode', query?.courseCode || '');
    params = params.append('courseTitle', query?.courseTitle || '');

    return this.http.get<IAPIResponse<any>>(`${this.coursesUrl}`, { params });
  }

  getCourse(courseId: string): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(`${this.coursesUrl}/${courseId}`);
  }

  getRecentCourses(): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(`${this.coursesUrl}/recently-used`);
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
      { lecturer: lecturerId }
    );
  }
}
