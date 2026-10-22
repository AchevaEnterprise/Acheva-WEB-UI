import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  DuesStandingStatus,
  IDuesCollectionsPage,
} from '../models/collections.model';

export interface IDuesCollectionsQuery {
  session?: string;
  level?: string;
  status?: DuesStandingStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * The Head's collections table.
 *
 * The department is resolved server-side from the signed-in Head's record,
 * never sent from here — a lecturer moved between departments this morning
 * must not be able to read the old one's roster.
 */
@Injectable({ providedIn: 'root' })
export class DuesCollectionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.BASE_URL}/dues/my-department`;

  collections(
    query: IDuesCollectionsQuery = {}
  ): Observable<IAPIResponse<IDuesCollectionsPage>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<IAPIResponse<IDuesCollectionsPage>>(
      `${this.base}/collections`,
      {
        params,
      }
    );
  }
}
