import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EmptyStateComponent } from '../../@shared/components/empty-state/empty-state.component';
import { INotification } from './models/notification.model';

@Component({
  selector: 'app-notifications',
  imports: [EmptyStateComponent, DatePipe],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {
  readonly data = inject<{ notifications: INotification[] }>(MAT_DIALOG_DATA);
}
