import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  ICreateResult,
  ICreateResultEntry,
  IResult,
  IResultEntriesQuery,
  IResultQuery,
  IUpdateResultEntry,
} from '../models/results.model';

@Injectable({
  providedIn: 'root',
})
export class ResultsService {
  private readonly http = inject(HttpClient);
  private readonly resultsUrl = `${environment.BASE_URL}/results`;

  getResults(query?: IResultQuery): Observable<IAPIResponse<any>> {
    let params = new HttpParams();
    params = params.append('status', query?.status || '');

    return this.http.get<IAPIResponse<IResult>>(`${this.resultsUrl}`, {
      params,
    });
  }

  getResult(resultId: string): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(`${this.resultsUrl}/${resultId}`);
  }

  getResultEntries(
    resultId: string,
    query?: IResultEntriesQuery
  ): Observable<IAPIResponse<any>> {
    let params = new HttpParams();
    params = params.append('category', query?.category || '');

    if (query?.fullName) params = params.append('fullName', query?.fullName || '');
    if (query?.limit) params = params.append('limit', query?.limit || '');

    return this.http.get<IAPIResponse<any>>(
      `${this.resultsUrl}/${resultId}/entries`,
      {
        params,
      }
    );
  }

  sendResult(
    resultId: string,
    recepientId: string
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.resultsUrl}/${resultId}/send/${recepientId}`,
      {}
    );
  }

  createResult(result: ICreateResult): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(`${this.resultsUrl}`, result);
  }

  createResultEntry(
    resultEntry: ICreateResultEntry
  ): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(
      `${this.resultsUrl}/entries`,
      resultEntry
    );
  }

  createBulkResultEntries(
    entries: ICreateResultEntry[]
  ): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(
      `${this.resultsUrl}/entries/bulk`,
      entries
    );
  }

  updateResult(
    resultId: string,
    result: Partial<ICreateResult>
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.resultsUrl}/${resultId}`,
      result
    );
  }

  updateResultEntry(
    resultEntryId: string,
    resultEntry: Partial<ICreateResultEntry>
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.resultsUrl}/entries/${resultEntryId}`,
      resultEntry
    );
  }

  updateBulkResultEntry(
    resultEntries: Partial<IUpdateResultEntry>
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.resultsUrl}/entries/bulk`,
      resultEntries
    );
  }

  updateBulkResultEntries(entries: any[]): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.resultsUrl}/entries/bulk`,
      entries
    );
  }

  deleteResultEntry(resultEntryId: string): Observable<IAPIResponse<any>> {
    return this.http.delete<IAPIResponse<any>>(
      `${this.resultsUrl}/${resultEntryId}/entries`
    );
  }

  deleteBulkResultEntries(
    resultEntryIds: string[]
  ): Observable<IAPIResponse<any>> {
    return this.http.delete<IAPIResponse<any>>(
      `${this.resultsUrl}/entries/bulk`,
      { body: { entryIds: resultEntryIds } }
    );
  }

  // Import Result - Upload CSV/Excel files
  uploadResultFile(
    resultId: string,
    file: File
  ): Observable<IAPIResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<IAPIResponse<any>>(
      `${this.resultsUrl}/entries/import/${resultId}`,
      formData
    );
  }

  // Create single result entry for grid input
  createSingleResultEntry(entry: {
    registrationNumber: string;
    fullName: string;
    test: number;
    lab: number;
    exam: number;
    total: number;
    result: string;
  }): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(
      `${this.resultsUrl}/entries`,
      entry
    );
  }

  // Create multiple result entries for bulk grid operations
  createMultipleResultEntries(
    entries: Array<{
      registrationNumber: string;
      fullName: string;
      test: number;
      lab: number;
      exam: number;
      total: number;
      result: string;
    }>
  ): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(
      `${this.resultsUrl}/entries/bulk`,
      entries
    );
  }

  updateResultEntriesWithAnalytics(
    resultId: string,
    entries: any[]
  ): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.resultsUrl}/${resultId}/entries`,
      { entries }
    );
  }

  getResultAnalytics(resultId: string): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(
      `${this.resultsUrl}/${resultId}/analytics`
    );
  }
}
