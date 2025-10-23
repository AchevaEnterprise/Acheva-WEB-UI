import { Component, inject, OnInit, output, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, interval } from 'rxjs';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { UtilityService } from '../../@core/utility/utility.service';
import { RoleEnum } from '../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { NotificationService } from '../../@features/notifications/service/notification.service';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { MatDialog } from '@angular/material/dialog';
import { NotificationsComponent } from '../../@features/notifications/notifications.component';

@Component({
  selector: 'app-tool-bar',
  imports: [
    SvgComponent,
    ImageFallbackDirective,
    MatBadgeModule,
    MatMenuModule,
  ],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly utillityService = inject(UtilityService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  switchAccountEvent = output<string>();
  activeAccount = this.authService.activeAccount;
  accounts = this.authService.accounts;

  RoleEnum = RoleEnum;

  pageTitle = signal<string>('');
  breadcrumbs = signal<{label: string, link?: string}[]>([]);
  badgeCount = signal<string>(this.utillityService.formatCount(0));
  notifications = signal<any[]>([]);
  unreadCount = signal<number>(0);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe({
        next: () => {
          let currentRoute = this.route;
          while (currentRoute.firstChild)
            currentRoute = currentRoute.firstChild;

          const data = currentRoute.snapshot.data;
          this.pageTitle.set(data['title'] ?? '');
          this.breadcrumbs.set(data['breadcrumbs'] ?? []);
        },
      });
  }

  ngOnInit(): void {
    this.loadNotifications();
    interval(30000).subscribe(() => {
      this.loadNotifications();
    });
    
    // Listen for custom refresh events
    document.addEventListener('refreshNotifications', () => {
      this.loadNotifications();
    });
  }

  switchAccount(accountId: string) {
    this.switchAccountEvent.emit(accountId);
  }

  openNotification() {
    this.dialog.open(NotificationsComponent, {
      width: '30%',
      height: '98%',
      position: { right: '10px' },
    });
    this.badgeCount.set('');
  }

  private loadNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (resp) => {
        if (resp.status && resp.data) {
          this.notifications.set(resp.data);
          const unreadNotifications = resp.data.filter((n: any) => n.status === 'UNREAD');
          const count = unreadNotifications.length;
          this.unreadCount.set(count);
          this.badgeCount.set(count > 0 ? count.toString() : '');
        }
      },
      error: (error) => {
        console.warn('Failed to load notifications:', error);
        this.badgeCount.set('');
      }
    });
  }

  refreshNotifications() {
    this.loadNotifications();
  }

  navigateTo(link: string) {
    this.router.navigate([link]);
  }
}
