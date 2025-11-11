import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, finalize } from 'rxjs';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { ToastService } from '../../@core/utility/toast.service';
import { UtilityService } from '../../@core/utility/utility.service';
import { RoleEnum } from '../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { INotification } from '../../@features/notifications/models/notification.model';
import { NotificationsComponent } from '../../@features/notifications/notifications.component';
import { NotificationService } from '../../@features/notifications/service/notification.service';
import { SvgComponent } from '../../@shared/components/svg/svg.component';

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
  private readonly utilityService = inject(UtilityService);
  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  activeAccount = this.authService.activeAccount;
  activeRole = computed(() => this.activeAccount()?.role);

  roles = computed(() => {
    const account = this.activeAccount();
    const currentRole = account?.role;
    const otherRoles = account?.otherRoles ?? [];

    return [
      {
        label: 'Course Advisor',
        role: RoleEnum.COURSE_ADVISOR,
        disabled:
          currentRole !== RoleEnum.COURSE_ADVISOR &&
          !otherRoles.includes(RoleEnum.COURSE_ADVISOR),
      },
      {
        label: 'Course Coordinator',
        role: RoleEnum.COURSE_COORDINATOR,
        disabled:
          currentRole !== RoleEnum.COURSE_COORDINATOR &&
          !otherRoles.includes(RoleEnum.COURSE_COORDINATOR),
      },
      {
        label: 'Lecturer',
        role: RoleEnum.LECTURER,
        disabled:
          currentRole !== RoleEnum.LECTURER &&
          !otherRoles.includes(RoleEnum.LECTURER),
      },
    ];
  });

  RoleEnum = RoleEnum;

  pageTitle = signal<string>('');
  breadcrumbs = signal<{ label: string; link?: string }[]>([]);
  badgeCount = signal<string>(this.utilityService.formatCount(0));
  notifications = signal<INotification[]>([]);
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
  }

  switchToRole(role: RoleEnum) {
    if (this.activeRole() === role) {
      this.toast.showNotification(
        'error',
        'Active role',
        `You are already operating as a ${role}`
      );

      return;
    }

    this.utilityService.showLoader();
    this.authService
      .switchRole(role)
      .pipe(finalize(() => this.utilityService.hideLoader()))
      .subscribe({
        next: (response) => {
          if (response.status) {
            this.toast.showNotification(
              'success',
              'Role Switched',
              `You are operating as a ${role}`
            );
          }
        },
      });
  }

  openNotification() {
    this.dialog.open(NotificationsComponent, {
      width: '30%',
      height: '98%',
      position: { right: '10px' },
    });
  }

  private loadNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (resp) => {
        if (resp.status && resp.data) {
          this.notifications.set(resp.data);
          const unreadNotifications = resp.data.filter(
            (n: INotification) => n.status === 'UNREAD'
          );
          const count = unreadNotifications.length;
          this.unreadCount.set(count);
          this.badgeCount.set(count > 0 ? count.toString() : '');
        }
      },
      error: (error) => {
        this.badgeCount.set('');
      },
    });
  }

  navigateTo(link: string) {
    this.router.navigate([link]);
  }
}
