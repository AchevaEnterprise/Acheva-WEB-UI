import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  IBank,
  IPayoutAccount,
  ISavePayoutAccount,
} from '../models/payout-account.model';

/**
 * The department's payout account. Writes are HOD-only on the server — this
 * decides where money lands.
 */
@Injectable({ providedIn: 'root' })
export class PayoutAccountService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.BASE_URL;

  /** Null when the department has not set one up — the normal starting state. */
  myDepartment(): Observable<IAPIResponse<IPayoutAccount | null>> {
    return this.http.get<IAPIResponse<IPayoutAccount | null>>(
      `${this.base}/accounts/my-department`
    );
  }

  banks(): Observable<IAPIResponse<IBank[]>> {
    return this.http.get<IAPIResponse<IBank[]>>(`${this.base}/banks`);
  }

  create(payload: ISavePayoutAccount): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.base}/accounts`,
      payload
    );
  }

  update(
    id: string,
    payload: ISavePayoutAccount
  ): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.base}/accounts/${id}`,
      payload
    );
  }
}
