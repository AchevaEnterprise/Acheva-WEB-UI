import { Component, inject, OnInit, signal } from '@angular/core';
import { EmptyStateComponent } from '../../@shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../@shared/components/loader/loader.component';
import { NotificationService } from './service/notification.service';

@Component({
  selector: 'app-notifications',
  imports: [EmptyStateComponent, LoaderComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);

  loading = signal<boolean>(false);
  notifications = signal<any[]>([]);

  ngOnInit(): void {
    this.getNotifications();
  }

  getNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (resp) => {
        if (resp.status) {
          this.notifications.set(resp.data);
        }
      },
    });
  }
}
