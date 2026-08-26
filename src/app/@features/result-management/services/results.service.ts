import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IAPIPaginatedResponse,
  IAPIResponse,
} from '../../../@core/models/api-response.model';
import { SemesterEnum } from '../../../@core/models/school.model';
import { RoleEnum } from '../../auth/model/auth.model';
import { IResultSheet } from '../models/result-sheet.model';
import {
  IStudentResult,
  IStudentSessionsResult,
} from '../../students/models/student.model';
import {
  ICreateResult,
  ICreateResultEntry,
  IGroupedResult,
  IReferenceCandidate,
  IPreparedResultQuery,
  IResult,
  IResultComment,
  IResultEntriesQuery,
  IResultQuery,
  IResultStatusCount,
  ISendSelectedResult,
  IUpdateResultEntry,
} from '../models/results.model';

@Injectable({
  providedIn: 'root',
})
export class ResultsService {
  private readonly http = inject(HttpClient);
  private readonly resultsUrl = `${environment.BASE_URL}/results`;

  // RESULT
  getResults(
    query?: Partial<IResultQuery>
  ): Observable<IAPIPaginatedResponse<IResult[]>> {
    let params = new HttpParams();
    if (query) {
      if (query.status) {
        params = params.append('status', query.status);
      }
      if (query.course) {
        params = params.append('course', query.course);
      }
      if (query.hasBeenSent) {
        params = params.append('hasBeenSent', query.hasBeenSent.toString());
      }
      if (query.faculty) {
        params = params.append('faculty', query.faculty);
      }
      if (query.department) {
        params = params.append('department', query.department);
      }
    }

    return this.http.get<IAPIPaginatedResponse<IResult[]>>(
      `${this.resultsUrl}`,
      {
        params,
      }
    );
  }

  getResult(resultId: string): Observable<IAPIResponse<IResult>> {
    return this.http.get<IAPIResponse<IResult>>(
      `${this.resultsUrl}/${resultId}`
    );
  }

  getGroupResults(): Observable<
    IAPIResponse<{
      data: IGroupedResult[];
      message: string;
      total: number;
    }>
  > {
    return this.http.get<
      IAPIResponse<{
        data: IGroupedResult[];
        message: string;
        total: number;
      }>
    >(`${this.resultsUrl}/sent/grouped`);
  }

  getPreparedResults(
    query?: Partial<IPreparedResultQuery>
  ): Observable<IAPIResponse<unknown>> {
    return this.http.get<IAPIResponse<unknown>>(
      `${this.resultsUrl}/prepared-results`
    );
  }

  /**
   * `GET /results/:id/reference-candidate` — may this typed registration
   * number join the result as a REFERENCE row?
   *
   * Result-scoped, unlike the school-wide student lookup: a reference student
   * must come from the SAME department as the cohort, and this says who a
   * foreign number actually belongs to so the lecturer can see what happened.
   */
  checkReferenceCandidate(
    resultId: string,
    registrationNumber: string
  ): Observable<IAPIResponse<IReferenceCandidate>> {
    const params = new HttpParams().append(
      'registrationNumber',
      registrationNumber
    );
    return this.http.get<IAPIResponse<IReferenceCandidate>>(
      `${this.resultsUrl}/${resultId}/reference-candidate`,
      { params }
    );
  }

  /**
   * `GET /results/:id/sheet` — the printable/exportable payload. One object,
   * rendered by both the PDF and the spreadsheet.
   */
  getResultSheet(resultId: string): Observable<IAPIResponse<IResultSheet>> {
    return this.http.get<IAPIResponse<IResultSheet>>(
      `${this.resultsUrl}/${resultId}/sheet`
    );
  }

  getResultComments(
    resultId: string
  ): Observable<IAPIResponse<IResultComment[]>> {
    return this.http.get<IAPIResponse<IResultComment[]>>(
      `${this.resultsUrl}/${resultId}/comments`
    );
  }

  sendResultComment(resultId: string, comment: string) {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/comments`,
      { comment }
    );
  }

  sendResult(
    resultId: string,
    recepientId: string,
    role: RoleEnum
  ): Observable<IAPIResponse<unknown>> {
    let params = new HttpParams();
    params = params.append('role', role);

    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/send/${recepientId}`,
      {},
      { params }
    );
  }

  sendSelectedResult(
    payload: ISendSelectedResult[],
    role: RoleEnum
  ): Observable<IAPIResponse<unknown>> {
    let params = new HttpParams();
    params = params.append('role', role);

    return this.http.post<IAPIResponse<unknown>>(
      `${this.resultsUrl}/selected`,
      payload,
      { params }
    );
  }

  sendBulkResult(
    role: RoleEnum,
    courseIds: Array<string>
  ): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.resultsUrl}/bulk/many`,
      { role, courseIds }
    );
  }

  createResult(result: ICreateResult): Observable<IAPIResponse<IResult>> {
    return this.http.post<IAPIResponse<IResult>>(`${this.resultsUrl}`, result);
  }

  updateResult(
    resultId: string,
    result: Partial<ICreateResult>
  ): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}`,
      result
    );
  }

  // RESULT ENTRIES
  getResultEntries(
    resultId: string,
    query?: Partial<IResultEntriesQuery>
  ): Observable<IAPIResponse<unknown>> {
    let params = new HttpParams();
    if (query) {
      if (query.category) {
        params = params.append('category', query.category);
      }
      if (query.fullName) {
        params = params.append('fullName', query.fullName);
      }
      if (query.limit) {
        params = params.append('limit', query.limit);
      }
    }

    return this.http.get<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/entries`,
      {
        params,
      }
    );
  }

  createResultEntry(
    resultEntry: ICreateResultEntry
  ): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.resultsUrl}/entries`,
      resultEntry
    );
  }

  updateResultEntry(
    resultEntryId: string,
    resultEntry: Partial<ICreateResultEntry>
  ): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/entries/${resultEntryId}`,
      resultEntry
    );
  }

  deleteResultEntry(resultEntryId: string): Observable<IAPIResponse<unknown>> {
    return this.http.delete<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultEntryId}/entries`
    );
  }

  createBulkResultEntries(
    entries: ICreateResultEntry[]
  ): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.resultsUrl}/entries/bulk`,
      entries
    );
  }

  updateBulkResultEntry(
    resultEntries: Partial<IUpdateResultEntry>
  ): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/entries/bulk`,
      resultEntries
    );
  }

  deleteBulkResultEntries(
    resultEntryIds: string[]
  ): Observable<IAPIResponse<unknown>> {
    return this.http.delete<IAPIResponse<unknown>>(
      `${this.resultsUrl}/entries/bulk`,
      { body: { entryIds: resultEntryIds } }
    );
  }

  uploadResultFile(
    resultId: string,
    file: File
  ): Observable<IAPIResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<IAPIResponse<unknown>>(
      `${this.resultsUrl}/entries/import/${resultId}`,
      formData
    );
  }

  updateResultEntriesWithAnalytics(
    resultId: string,
    entries: IResult[]
  ): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/entries`,
      { entries }
    );
  }

  getResultAnalytics(resultId: string): Observable<IAPIResponse<unknown>> {
    return this.http.get<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/analytics`
    );
  }

  getResultStatusCounts(): Observable<IAPIResponse<IResultStatusCount>> {
    return this.http.get<IAPIResponse<IResultStatusCount>>(
      `${this.resultsUrl}/status-counts`
    );
  }

  getCourseResultsAnalytics(query: {
    courseId: string;
    session: string;
  }): Observable<IAPIResponse<unknown>> {
    let params = new HttpParams();
    if (query) {
      if (query.courseId) {
        params = params.append('courseId', query.courseId);
      }
      if (query.session) {
        params = params.append('session', query.session);
      }
    }
    return this.http.get<IAPIResponse<unknown>>(
      `${this.resultsUrl}/total-analytics`,
      { params }
    );
  }

  deleteResult(resultId: string) {
    return this.http.delete<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}`
    );
  }

  approveResult(
    resultId: string,
    comment?: string,
    issueStatus?: 'RESOLVED' | 'UNRESOLVED'
  ) {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/approve`,
      {
        action: 'APPROVED',
        comment,
        issueStatus,
      }
    );
  }

  rejectResult(resultId: string, comment: string) {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/reject`,
      {
        action: 'REJECTED',
        comment,
      }
    );
  }

  publishResult(resultId: string) {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/publish`,
      {}
    );
  }

  getStudentResult(
    studentId: string,
    level: string,
    session: string,
    semester?: SemesterEnum
  ): Observable<IAPIResponse<IStudentResult>> {
    let params = new HttpParams();
    if (studentId) params = params.append('studentId', studentId);
    if (level) params = params.append('level', level);
    if (session) params = params.append('session', session);
    if (semester) params = params.append('semester', semester);

    return this.http.get<IAPIResponse<IStudentResult>>(
      `${this.resultsUrl}/students/results`,
      { params }
    );
  }

  getStudentResultsBySessions(
    studentId: string
  ): Observable<IAPIResponse<IStudentSessionsResult[]>> {
    let params = new HttpParams();
    params = params.append('studentId', studentId);

    return this.http.get<IAPIResponse<IStudentSessionsResult[]>>(
      `${this.resultsUrl}/students/results/sessions`,
      { params }
    );
  }
}
