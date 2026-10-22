import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  ICreateTransfer,
  IDepartmentTransfer,
  ITransferEligibility,
  TransferStatus,
} from '../models/transfer.model';

@Injectable({ providedIn: 'root' })
export class TransfersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.BASE_URL}/transfers`;

  /** Everything on my desk, plus everything I raised. */
  list(filters?: {
    status?: TransferStatus;
    student?: string;
  }): Observable<IAPIResponse<IDepartmentTransfer[]>> {
    let params = new HttpParams();
    if (filters?.status) params = params.append('status', filters.status);
    if (filters?.student) params = params.append('student', filters.student);
    return this.http.get<IAPIResponse<IDepartmentTransfer[]>>(this.url, {
      params,
    });
  }

  findOne(id: string): Observable<IAPIResponse<IDepartmentTransfer>> {
    return this.http.get<IAPIResponse<IDepartmentTransfer>>(
      `${this.url}/${id}`
    );
  }

  eligibility(student: string): Observable<IAPIResponse<ITransferEligibility>> {
    return this.http.get<IAPIResponse<ITransferEligibility>>(
      `${this.url}/eligibility`,
      { params: new HttpParams().append('student', student) }
    );
  }

  create(
    payload: ICreateTransfer
  ): Observable<IAPIResponse<IDepartmentTransfer>> {
    return this.http.post<IAPIResponse<IDepartmentTransfer>>(this.url, payload);
  }

  updateDraft(
    id: string,
    payload: { letterBody?: string; toLevel?: string; toSemester?: string }
  ): Observable<IAPIResponse<IDepartmentTransfer>> {
    return this.http.patch<IAPIResponse<IDepartmentTransfer>>(
      `${this.url}/${id}/draft`,
      payload
    );
  }

  submit(id: string): Observable<IAPIResponse<IDepartmentTransfer>> {
    return this.http.patch<IAPIResponse<IDepartmentTransfer>>(
      `${this.url}/${id}/submit`,
      {}
    );
  }

  cancel(id: string): Observable<IAPIResponse<IDepartmentTransfer>> {
    return this.http.patch<IAPIResponse<IDepartmentTransfer>>(
      `${this.url}/${id}/cancel`,
      {}
    );
  }

  approve(
    id: string,
    comment?: string
  ): Observable<IAPIResponse<IDepartmentTransfer>> {
    return this.http.patch<IAPIResponse<IDepartmentTransfer>>(
      `${this.url}/${id}/approve`,
      { comment }
    );
  }

  reject(
    id: string,
    reason: string,
    comment?: string
  ): Observable<IAPIResponse<IDepartmentTransfer>> {
    return this.http.patch<IAPIResponse<IDepartmentTransfer>>(
      `${this.url}/${id}/reject`,
      { reason, comment }
    );
  }
}
