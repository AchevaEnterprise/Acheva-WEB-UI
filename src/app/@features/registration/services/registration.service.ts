import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  ICourseRegistration,
  IElectiveReview,
  ICurriculumEntry,
  ICurriculumImportReport,
  IOutstandingCarryOver,
  IOutstandingExcusedCourse,
  IRunReport,
  IStudentCgpa,
} from '../models/registration.model';

export interface IRegistrationsQuery {
  session?: string;
  semester?: string;
  level?: string;
  status?: string;
  studentId?: string;
}

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.BASE_URL}/registrations`;
  private readonly curriculumUrl = `${environment.BASE_URL}/curriculum`;

  run(session: string, semester: string): Observable<IAPIResponse<IRunReport>> {
    return this.http.post<IAPIResponse<IRunReport>>(`${this.baseUrl}/run`, {
      session,
      semester,
    });
  }

  list(
    query: IRegistrationsQuery
  ): Observable<IAPIResponse<ICourseRegistration[]>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params = params.append(key, value);
    }
    return this.http.get<IAPIResponse<ICourseRegistration[]>>(this.baseUrl, {
      params,
    });
  }

  findOne(id: string): Observable<IAPIResponse<ICourseRegistration>> {
    return this.http.get<IAPIResponse<ICourseRegistration>>(
      `${this.baseUrl}/${id}`
    );
  }

  editEntries(
    id: string,
    body: {
      add?: { courseId: string }[];
      drop?: { courseId: string; reason?: string }[];
    }
  ): Observable<IAPIResponse<ICourseRegistration>> {
    return this.http.patch<IAPIResponse<ICourseRegistration>>(
      `${this.baseUrl}/${id}/entries`,
      body
    );
  }

  /** Entry-table gating: who in the cohort is registered for a result's course. */
  courseRoster(resultId: string): Observable<
    IAPIResponse<{
      hasRegistrationData: boolean;
      registeredStudentIds: string[];
      registeredRegNos: string[];
    }>
  > {
    return this.http.get<
      IAPIResponse<{
        hasRegistrationData: boolean;
        registeredStudentIds: string[];
        registeredRegNos: string[];
      }>
    >(`${this.baseUrl}/course-roster/${resultId}`);
  }

  /** Audit + CA notify when a lecturer enables an unregistered student's row. */
  rosterOverride(body: {
    resultId: string;
    studentId?: string;
    studentName?: string;
  }): Observable<IAPIResponse<{ notified: boolean }>> {
    return this.http.post<IAPIResponse<{ notified: boolean }>>(
      `${this.baseUrl}/roster-override`,
      body
    );
  }

  /** The CA's pending elective decisions (fail / low-grade outcomes). */
  reviews(): Observable<IAPIResponse<IElectiveReview[]>> {
    return this.http.get<IAPIResponse<IElectiveReview[]>>(
      `${this.baseUrl}/reviews`
    );
  }

  /** Decisions already made (last 14 days), newest first — the undo list. */
  recentlyDecidedReviews(): Observable<IAPIResponse<IElectiveReview[]>> {
    return this.http.get<IAPIResponse<IElectiveReview[]>>(
      `${this.baseUrl}/reviews/recent`
    );
  }

  decideReview(
    id: string,
    decision: 'KEEP' | 'UNREGISTER' | 'APPROVE' | 'REJECT',
    note?: string
  ): Observable<IAPIResponse<IElectiveReview>> {
    return this.http.patch<IAPIResponse<IElectiveReview>>(
      `${this.baseUrl}/reviews/${id}`,
      { decision, note }
    );
  }

  /** Audited undo of a decided review — returns it to the pending queue. */
  revertReview(id: string): Observable<IAPIResponse<IElectiveReview>> {
    return this.http.post<IAPIResponse<IElectiveReview>>(
      `${this.baseUrl}/reviews/${id}/revert`,
      {}
    );
  }

  /**
   * CA excuses a student from sitting a course. Drops the line without a
   * grade and leaves the course outstanding — it returns in a later session
   * as a fresh registration, never a carry-over.
   */
  excuseCourse(
    id: string,
    courseId: string,
    note?: string
  ): Observable<IAPIResponse<ICourseRegistration>> {
    return this.http.patch<IAPIResponse<ICourseRegistration>>(
      `${this.baseUrl}/${id}/excuse`,
      { courseId, note }
    );
  }

  /** Courses the student was excused from and must still take. */
  excusedCourses(
    studentId: string
  ): Observable<IAPIResponse<IOutstandingExcusedCourse[]>> {
    return this.http.get<IAPIResponse<IOutstandingExcusedCourse[]>>(
      `${this.baseUrl}/excused/${studentId}`
    );
  }

  /** CA reset — deletes one registration so the next run regenerates it. */
  reset(id: string): Observable<IAPIResponse<{ deleted: boolean }>> {
    return this.http.delete<IAPIResponse<{ deleted: boolean }>>(
      `${this.baseUrl}/${id}`
    );
  }

  /** The school's admin-controlled active session/semester (may be null). */
  schoolSettings(): Observable<
    IAPIResponse<{
      activeSession: string;
      activeSemester: string;
      registrationGraceDays: number;
    } | null>
  > {
    return this.http.get<
      IAPIResponse<{
        activeSession: string;
        activeSemester: string;
        registrationGraceDays: number;
      } | null>
    >(`${environment.BASE_URL}/school-settings`);
  }

  approveOverload(id: string): Observable<IAPIResponse<ICourseRegistration>> {
    return this.http.patch<IAPIResponse<ICourseRegistration>>(
      `${this.baseUrl}/${id}/approve-overload`,
      {}
    );
  }

  carryOvers(
    studentId: string
  ): Observable<IAPIResponse<IOutstandingCarryOver[]>> {
    return this.http.get<IAPIResponse<IOutstandingCarryOver[]>>(
      `${this.baseUrl}/carryovers/${studentId}`
    );
  }

  cgpa(studentId: string): Observable<IAPIResponse<IStudentCgpa>> {
    return this.http.get<IAPIResponse<IStudentCgpa>>(
      `${this.baseUrl}/cgpa/${studentId}`
    );
  }

  // ── Curriculum ────────────────────────────────────────────────────────────

  curriculum(
    departmentId: string,
    level?: string,
    semester?: string
  ): Observable<IAPIResponse<ICurriculumEntry[]>> {
    let params = new HttpParams().append('departmentId', departmentId);
    if (level) params = params.append('level', level);
    if (semester) params = params.append('semester', semester);
    return this.http.get<IAPIResponse<ICurriculumEntry[]>>(this.curriculumUrl, {
      params,
    });
  }

  importCurriculum(
    file: File
  ): Observable<IAPIResponse<ICurriculumImportReport>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<IAPIResponse<ICurriculumImportReport>>(
      `${this.curriculumUrl}/import`,
      form
    );
  }

  /** Direct download URL for the import template (opened in a new tab). */
  get templateUrl(): string {
    return `${this.curriculumUrl}/template`;
  }
}
