import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import { LevelsEnum } from '../../../@core/models/school.model';
import { RoleEnum } from '../../auth/model/auth.model';
import { ILecturer } from '../models/lecturer.model';

@Injectable({
  providedIn: 'root',
})
export class LecturersService {
  private readonly http = inject(HttpClient);
  private readonly lecturerUrl = `${environment.BASE_URL}/lecturers`;

  getLecturersInDepartment(
    departmentId: string
  ): Observable<IAPIResponse<ILecturer[]>> {
    return this.http
      .get<IAPIResponse<ILecturer[]>>(`${this.lecturerUrl}/all/${departmentId}`)
      .pipe(
        map((resp) => ({
          ...resp,
          data: resp.data.filter((lect) => lect.role !== RoleEnum.DEAN),
        }))
      );
  }

  getLecturer(lecturerId: string): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(
      `${this.lecturerUrl}/${lecturerId}`
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

  assignOrUnassignCourseAdvisor(
    lecturerId: string,
    level: LevelsEnum | 'NONE'
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.lecturerUrl}/assign-course-advisor/${lecturerId}`,
      {
        level,
      }
    );
  }
}
