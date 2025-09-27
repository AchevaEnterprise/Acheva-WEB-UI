import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import { LevelsEnum } from '../../../@core/models/school.model';
import { LecturerAssignment } from '../models/lecturer.model';

@Injectable({
  providedIn: 'root',
})
export class LecturersService {
  private readonly http = inject(HttpClient);
  private readonly lecturerUrl = `${environment.BASE_URL}/lecturers`;

  getLecturersInDepartment(
    departmentId: string
  ): Observable<IAPIResponse<LecturerAssignment[]>> {
    return this.http.get<IAPIResponse<LecturerAssignment[]>>(
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
