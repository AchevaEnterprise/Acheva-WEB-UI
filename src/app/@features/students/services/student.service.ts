import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  IStudent,
  IStudentPerformance,
  IStudentQuery,
  IStudentResult,
} from '../models/student.model';

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly studentUrl = `${environment.BASE_URL}/students`;

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

  getStudentByRegNo(regNo: string): Observable<IAPIResponse<IStudent>> {
    let params = new HttpParams();
    params = params.append('registrationNumber', regNo);
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

  getStudentResult(
    level: string,
    session: string
  ): Observable<IAPIResponse<IStudentResult>> {
    let params = new HttpParams();
    params = params.append('level', level);
    params = params.append('session', session);

    return this.http.get<IAPIResponse<IStudentResult>>(
      `${this.studentUrl}/results`,
      { params }
    );
  }

  getStudentAnalytics(): Observable<IAPIResponse<IStudentPerformance>> {
    return this.http.get<IAPIResponse<IStudentPerformance>>(
      `${this.studentUrl}/analytics`
    );
  }
}
