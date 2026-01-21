import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, finalize } from 'rxjs';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { RoleAccessDirective } from '../../@core/directives/role-access.directive';
import { FacultyInitialPipe } from '../../@core/pipes/faculty-initial.pipe';
import { ToastService } from '../../@core/utility/toast.service';
import { UtilityService } from '../../@core/utility/utility.service';
import { RoleEnum } from '../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { INotification } from '../../@features/notifications/models/notification.model';
import { NotificationsComponent } from '../../@features/notifications/notifications.component';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { Store } from '@ngrx/store';
import { AppState } from '../../@core/store/app.state';
import { loadNotification } from '../../@core/store/notification/notification.action';
import { notificationSelector } from '../../@core/store/notification/notification.selector';

@Component({
  selector: 'app-tool-bar',
  imports: [
    SvgComponent,
    ImageFallbackDirective,
    MatBadgeModule,
    MatMenuModule,
    RoleAccessDirective,
    FacultyInitialPipe,
  ],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly utilityService = inject(UtilityService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store<AppState>);

  activeAccount = this.authService.activeAccount;
  activeRole = computed(() => this.activeAccount()?.role);

  roles = computed(() => {
    const account = this.activeAccount();
    const currentRole = account?.role;
    const otherRoles = account?.otherRoles ?? [];

    return [
      {
        label: 'Dean',
        role: RoleEnum.DEAN,
        disabled:
          currentRole !== RoleEnum.DEAN && !otherRoles.includes(RoleEnum.DEAN),
      },
      {
        label: 'HOD',
        role: RoleEnum.HOD,
        disabled:
          currentRole !== RoleEnum.HOD && !otherRoles.includes(RoleEnum.HOD),
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

  beforeOpen(trigger: MatMenuTrigger) {
    const account = this.activeAccount();
    const currentRole = account?.role;
    const otherRoles = account?.otherRoles ?? [];

    const allowed =
      currentRole === RoleEnum.DEAN ||
      currentRole === RoleEnum.HOD ||
      otherRoles.some((r) => r === RoleEnum.HOD || r === RoleEnum.DEAN);

    if (!allowed) return;

    trigger.openMenu();
  }

  switchAccount(role: RoleEnum) {
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
      .switchAccount(role)
      .pipe(finalize(() => this.utilityService.hideLoader()))
      .subscribe({
        next: (response) => {
          if (response.status) {
            this.toast.showNotification(
              'success',
              'Account Switched Successfully',
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
      data: {
        notifications: this.notifications(),
      },
    });
  }

  private loadNotifications() {
    this.store.dispatch(loadNotification());
    this.store.select(notificationSelector).subscribe({
      next: (notifications) => {
        this.notifications.set(notifications);

        const unreadNotifications = notifications.filter(
          (n: INotification) => n.status === 'UNREAD'
        ).length;
        this.unreadCount.set(unreadNotifications);
        this.badgeCount.set(
          unreadNotifications > 0 ? unreadNotifications.toString() : ''
        );
      },
      error: () => {
        this.badgeCount.set('');
      },
    });
  }

  navigateTo(link: string) {
    this.router.navigate([link]);
  }
}
