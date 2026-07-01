import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  ICreateStudent,
  IStudent,
  IStudentAcademicFlags,
  IStudentPerformance,
  IStudentQuery,
} from '../models/student.model';

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly studentUrl = `${environment.BASE_URL}/students`;
  private readonly lecturerUrl = `${environment.BASE_URL}/lecturers`;

  createStudent(payload: ICreateStudent): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.lecturerUrl}/students`,
      payload
    );
  }

  getStudents(
    query: Partial<IStudentQuery>
  ): Observable<IAPIResponse<IStudent[]>> {
    let params = new HttpParams();
    if (query) {
      if (query.school) params = params.append('school', query.school);
      if (query.department)
        params = params.append('department', query.department);
      if (query.level) params = params.append('level', query.level);
    }
    return this.http.get<IAPIResponse<IStudent[]>>(
      `${this.studentUrl}/school`,
      {
        params,
      }
    );
  }

  getAcademicIssueFlags(
    query: Partial<IStudentQuery>
  ): Observable<IAPIResponse<IStudentAcademicFlags>> {
    let params = new HttpParams();
    if (query) {
      if (query.school) params = params.append('school', query.school);
      if (query.department)
        params = params.append('department', query.department);
      if (query.level) params = params.append('level', query.level);
    }
    // X-Silent-Error tells the global error interceptor to skip the toast for
    // this call. Flags are a background enrichment — a failure should be
    // invisible to the user; the list still renders without indicators.
    return this.http.get<IAPIResponse<IStudentAcademicFlags>>(
      `${this.studentUrl}/school/academic-flags`,
      { params, headers: { 'X-Silent-Error': 'true' } }
    );
  }

  getStudentByRegNo(
    regNo: string,
    schoolId: string
  ): Observable<IAPIResponse<IStudent>> {
    let params = new HttpParams();
    params = params.append('registrationNumber', regNo);
    params = params.append('school', schoolId);
    return this.http.get<IAPIResponse<IStudent>>(`${this.studentUrl}`, {
      params,
    });
  }

  getStudentProfile(): Observable<IAPIResponse<IStudent>> {
    return this.http.get<IAPIResponse<IStudent>>(`${this.studentUrl}/profile`);
  }

  getStudentPerformance(
    session: string,
    semester: string
  ): Observable<IAPIResponse<IStudentPerformance>> {
    let params = new HttpParams();
    params = params.append('session', session);
    params = params.append('semester', semester);

    return this.http.get<IAPIResponse<IStudentPerformance>>(
      `${this.studentUrl}/performance`,
      { params }
    );
  }

  getStudentAnalytics(): Observable<IAPIResponse<IStudentPerformance>> {
    return this.http.get<IAPIResponse<IStudentPerformance>>(
      `${this.studentUrl}/analytics`
    );
  }
}
