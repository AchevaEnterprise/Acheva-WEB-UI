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

  createNotification(notification: {
    title: string;
    message: string;
    type: string;
    recipientId: string;
    data?: any;
  }): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(`${this.notificationUrl}`, notification);
  }

  markAsRead(notificationId: string): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(`${this.notificationUrl}/${notificationId}/read`, {});
  }
}
