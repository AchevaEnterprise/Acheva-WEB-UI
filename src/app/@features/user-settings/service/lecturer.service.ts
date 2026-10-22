import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  IHandoverPreview,
  IHandoverResult,
} from '../models/course-advisor-handover.model';
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

  activateOrDeactivateLecturer(
    lecturerId: string,
    isActive: boolean
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.lecturerUrl}/toggle-active-status/${lecturerId}`,
      {
        isActive,
      }
    );
  }

  /**
   * What handing this cohort over would move. Changes nothing.
   *
   * Asked before the confirm button is enabled, so the Head sees the size
   * of what they are about to redirect.
   */
  previewCourseAdvisorHandover(
    from: string,
    to: string
  ): Observable<IAPIResponse<IHandoverPreview>> {
    return this.http.get<IAPIResponse<IHandoverPreview>>(
      `${this.lecturerUrl}/course-advisor/handover/preview`,
      { params: { from, to } }
    );
  }

  /** Hand the cohort over. Transactional server-side — all of it or none. */
  handOverCourseAdvisor(
    from: string,
    to: string
  ): Observable<IAPIResponse<IHandoverResult>> {
    return this.http.patch<IAPIResponse<IHandoverResult>>(
      `${this.lecturerUrl}/course-advisor/handover`,
      { from, to }
    );
  }

  assignCourseAdvisor(
    lecturerId: string,
    level: LevelsEnum,
    admissionYear: string
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.lecturerUrl}/assign-course-advisor/${lecturerId}`,
      {
        level,
        assignedLevelAdmissionYear: admissionYear,
      }
    );
  }

  unassignCourseAdvisor(lecturerId: string): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.lecturerUrl}/unassign-course-advisor/${lecturerId}`,
      {}
    );
  }

  importStudentDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<IAPIResponse<any>>(
      `${this.lecturerUrl}/students/import`,
      formData
    );
  }
}
