import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  DuesStatus,
  IDuesConfig,
  IDuesPage,
  IUpsertDues,
} from '../models/dues.model';

/**
 * Departmental dues — configuration only.
 *
 * There is deliberately no "pay" or "initialise transaction" method here.
 * Collection is a separate concern with its own module on the server; this
 * service only ever reads and writes what a department CHARGES.
 */
@Injectable({ providedIn: 'root' })
export class DuesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.BASE_URL}/dues`;

  /** This session's plan for my department, plus whether it may be edited. */
  myDepartment(): Observable<IAPIResponse<IDuesPage>> {
    return this.http.get<IAPIResponse<IDuesPage>>(
      `${this.baseUrl}/my-department`
    );
  }

  save(payload: IUpsertDues): Observable<IAPIResponse<IDuesConfig>> {
    return this.http.post<IAPIResponse<IDuesConfig>>(
      `${this.baseUrl}/my-department`,
      payload
    );
  }

  changeStatus(status: DuesStatus): Observable<IAPIResponse<IDuesConfig>> {
    return this.http.patch<IAPIResponse<IDuesConfig>>(
      `${this.baseUrl}/my-department/status`,
      { status }
    );
  }

  /**
   * An even split, from the server.
   *
   * Asked rather than computed locally so the odd kobo lands on the same
   * instalment at both ends — a client-side split that disagrees by one kobo
   * fails validation with an error the Head cannot act on.
   */
  split(
    totalKobo: number,
    count: number
  ): Observable<IAPIResponse<{ instalments: number[] }>> {
    return this.http.get<IAPIResponse<{ instalments: number[] }>>(
      `${this.baseUrl}/split?total=${totalKobo}&count=${count}`
    );
  }
}
