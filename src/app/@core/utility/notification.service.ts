import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppNotificationType } from '../models/notification.model';
import { ToastComponent } from '../../@shared/components/toast/toast.component';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  showNotification(
    type: AppNotificationType,
    title: string,
    message: string,
    duration = 5
  ): void {
    this.snackBar.openFromComponent(ToastComponent, {
      data: {
        type,
        title,
        message,
      },
      duration: duration * 1000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
