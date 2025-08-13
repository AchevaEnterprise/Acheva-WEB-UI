import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IAPIResponse } from '../models/api-response.model';
import { IDepartment, IFaculty, ISchool } from '../models/school.model';

@Injectable({
  providedIn: 'root',
})
export class SchoolsService {
  private readonly http = inject(HttpClient);
  private readonly schoolsUrl = `${environment.BASE_URL}/schools`;

  getSchools(): Observable<IAPIResponse<ISchool[]>> {
    return this.http.get<IAPIResponse<ISchool[]>>(`${this.schoolsUrl}`);
  }

  getFaculties(schoolId: string): Observable<IAPIResponse<IFaculty[]>> {
    return this.http.get<IAPIResponse<IFaculty[]>>(
      `${this.schoolsUrl}/${schoolId}/faculties`
    );
  }

  getDepartments(facultyId: string): Observable<IAPIResponse<IDepartment[]>> {
    return this.http.get<IAPIResponse<IDepartment[]>>(
      `${this.schoolsUrl}/faculties/${facultyId}/departments`
    );
  }

  getSchool(schoolId: string): Observable<IAPIResponse<ISchool>> {
    return this.http.get<IAPIResponse<ISchool>>(
      `${this.schoolsUrl}/${schoolId}`
    );
  }

  getFaculty(facultyId: string): Observable<IAPIResponse<ISchool>> {
    return this.http.get<IAPIResponse<ISchool>>(
      `${this.schoolsUrl}/faculties/${facultyId}`
    );
  }

  getDepartment(departmentId: string): Observable<IAPIResponse<ISchool>> {
    return this.http.get<IAPIResponse<ISchool>>(
      `${this.schoolsUrl}/faculties/departments/${departmentId}`
    );
  }
}
