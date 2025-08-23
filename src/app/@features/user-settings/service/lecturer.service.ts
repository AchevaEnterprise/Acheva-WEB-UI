import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';

@Injectable({
  providedIn: 'root',
})
export class LecturersService {
  private readonly http = inject(HttpClient);
  private readonly lecturerUrl = `${environment.BASE_URL}/lecturers`;

  getLecturersInDepartment(
    departmentId: string
  ): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(
      `${this.lecturerUrl}/all/${departmentId}`
    );
  }

  getdepartmentHOD(departmentId: string): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(
      `${this.lecturerUrl}/hod/${departmentId}`
    );
  }

  getfacultyDean(facultyId: string): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(
      `${this.lecturerUrl}/dean/${facultyId}`
    );
  }

  assignAsCourseAdvisor(lecturerId: string): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(`${this.lecturerUrl}/assign`, {
      lecturerId,
    });
  }

  revokeRoleAsCourseAdvisor(lecturerId: string): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(`${this.lecturerUrl}/revoke`, {
      lecturerId,
    });
  }
}
