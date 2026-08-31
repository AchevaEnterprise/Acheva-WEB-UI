import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  HistoryKind,
  IHistoryDetail,
  IHistoryPage,
  IHistoryQuery,
} from '../models/history.model';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.BASE_URL}/history`;

  /**
   * `GET /history` — the desk-scoped feed. The subject is always the caller's
   * own JWT; there is deliberately no lecturer parameter to pass.
   */
  getHistory(
    query: IHistoryQuery = {}
  ): Observable<IAPIResponse<IHistoryPage>> {
    let params = new HttpParams();

    if (query.page != null) params = params.append('page', String(query.page));
    if (query.limit != null)
      params = params.append('limit', String(query.limit));
    if (query.search) params = params.append('search', query.search);
    if (query.kind) params = params.append('kind', query.kind);
    if (query.session) params = params.append('session', query.session);
    if (query.semester) params = params.append('semester', query.semester);
    if (query.startDate) params = params.append('startDate', query.startDate);
    if (query.endDate) params = params.append('endDate', query.endDate);

    return this.http.get<IAPIResponse<IHistoryPage>>(this.baseUrl, { params });
  }

  /** `GET /history/:kind/:id` — the preview drawer payload. */
  getHistoryDetail(
    kind: HistoryKind,
    id: string
  ): Observable<IAPIResponse<IHistoryDetail>> {
    return this.http.get<IAPIResponse<IHistoryDetail>>(
      `${this.baseUrl}/${kind}/${id}`
    );
  }
}
