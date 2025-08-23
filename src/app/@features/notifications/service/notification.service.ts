import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly notificationUrl = `${environment.BASE_URL}/notifications`;

  getNotifications(): Observable<IAPIResponse<any>> {
    return this.http.get<IAPIResponse<any>>(`${this.notificationUrl}`);
  }
}
