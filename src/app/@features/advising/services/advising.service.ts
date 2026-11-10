import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import { IMySets, ISetStudents } from '../models/advising.model';

@Injectable({ providedIn: 'root' })
export class AdvisingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.BASE_URL}/advising`;

  /** My current set, my extra-year sets and every set I have held. */
  mySets(): Observable<IAPIResponse<IMySets>> {
    return this.http.get<IAPIResponse<IMySets>>(`${this.url}/sets`);
  }

  /** One set's students — its extra-year students, or all of them. */
  setStudents(
    admissionYear: string,
    view: 'extra-year' | 'all'
  ): Observable<IAPIResponse<ISetStudents>> {
    return this.http.get<IAPIResponse<ISetStudents>>(
      `${this.url}/sets/${encodeURIComponent(admissionYear)}/students`,
      { params: new HttpParams().append('view', view) }
    );
  }
}
