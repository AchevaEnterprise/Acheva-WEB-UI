import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IAPIPaginatedResponse,
  IAPIResponse,
} from '../../../@core/models/api-response.model';
import { RoleEnum } from '../../auth/model/auth.model';
import {
  ICreateResult,
  ICreateResultEntry,
  IPreparedResultQuery,
  IResult,
  IResultEntriesQuery,
  IResultQuery,
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

  getPreparedResults(
    query?: Partial<IPreparedResultQuery>
  ): Observable<IAPIResponse<unknown>> {
    return this.http.get<IAPIResponse<unknown>>(
      `${this.resultsUrl}/prepared-results`
    );
  }

  sendResult(
    resultId: string,
    recepientId: string
  ): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/send/${recepientId}`,
      {}
    );
  }

  sendSelectedResult(
    payload: ISendSelectedResult[]
  ): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.resultsUrl}/selected`,
      payload
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

  approveOrRejectResult(
    resultId: string,
    action: 'APPROVED' | 'REJECTED',
    comment?: string
  ) {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.resultsUrl}/${resultId}/approve-or-reject`,
      {
        action,
        comment,
      }
    );
  }
}
