import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AppState } from '../../@core/store/app.state';
import { loadNotification } from '../../@core/store/notification/notification.action';
import { notificationSelector } from '../../@core/store/notification/notification.selector';
import { EmptyStateComponent } from '../../@shared/components/empty-state/empty-state.component';
import { INotification } from './models/notification.model';
import { NotificationService } from './service/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  private readonly notificationService = inject(NotificationService);
  private readonly dialogRef = inject(MatDialogRef<NotificationsComponent>);
  private readonly destroyRef = inject(DestroyRef);

  notifications = signal<INotification[]>([]);
  marking = signal<boolean>(false);

  unreadCount = computed(
    () => this.notifications().filter((n) => n.status === 'UNREAD').length
  );

  ngOnInit(): void {
    this.store
      .select(notificationSelector)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((n) => this.notifications.set([...n]));

    this.store.dispatch(loadNotification());
  }

  close(): void {
    this.dialogRef.close();
  }

  markAsRead(notification: INotification): void {
    if (notification.status === 'READ') return;

    // Optimistic update
    this.notifications.update((list) =>
      list.map((n) => (n.id === notification.id ? { ...n, status: 'READ' as const } : n))
    );

    this.notificationService
      .markAsRead(notification.id)
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.store.dispatch(loadNotification()));
  }

  markAllAsRead(): void {
    if (this.unreadCount() === 0) return;

    // Optimistic update
    this.notifications.update((list) =>
      list.map((n) => ({ ...n, status: 'READ' as const }))
    );

    this.marking.set(true);
    this.notificationService
      .markAllAsRead()
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.marking.set(false))
      )
      .subscribe(() => this.store.dispatch(loadNotification()));
  }

  relativeTime(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  trackNotification(_index: number, n: INotification): string {
    return n.id;
  }
}
