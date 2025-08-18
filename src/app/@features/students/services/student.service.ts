import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly coursesUrl = `${environment.BASE_URL}/students`;

  getstudentByRegNo(regNo: string): Observable<IAPIResponse<any>> {
    let params = new HttpParams();
    params = params.append('registrationNumber', regNo);
    return this.http.get<IAPIResponse<any>>(`${this.coursesUrl}`, { params });
  }
}
