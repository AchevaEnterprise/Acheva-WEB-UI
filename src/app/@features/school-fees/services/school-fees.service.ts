import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  ISchoolFeeList,
  ISchoolFeeListQuery,
} from '../models/school-fees.model';

@Injectable({ providedIn: 'root' })
export class SchoolFeesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.BASE_URL}/school-fees`;

  /** Who has paid. The office held decides whose students — the server's call. */
  students(
    query: ISchoolFeeListQuery
  ): Observable<IAPIResponse<ISchoolFeeList>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.append(key, String(value));
    }
    return this.http.get<IAPIResponse<ISchoolFeeList>>(`${this.url}/students`, {
      params,
    });
  }

  /** One file of a student's receipt — streamed by the API to those allowed to see it. */
  receiptFile(
    id: string,
    which: 'schoolFeeReceipt' | 'remitaReceipt'
  ): Observable<Blob> {
    return this.http.get(`${this.url}/receipts/${id}/files/${which}`, {
      responseType: 'blob',
    });
  }
}
