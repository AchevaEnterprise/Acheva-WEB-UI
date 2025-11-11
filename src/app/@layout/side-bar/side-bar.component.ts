import { Component, computed, inject, output, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';

import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs';
import { MENU } from '../../@core/constant/menu';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { RoleAccessDirective } from '../../@core/directives/role-access.directive';
import { IMenu } from '../../@core/models/menu.model';
import { ToastService } from '../../@core/utility/toast.service';
import { UtilityService } from '../../@core/utility/utility.service';
import { RoleEnum } from '../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { SvgComponent } from '../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-side-bar',
  imports: [
    RouterLink,
    RouterLinkActive,
    SvgComponent,
    MatDividerModule,
    ImageFallbackDirective,
    RoleAccessDirective,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly utils = inject(UtilityService);
  private readonly toast = inject(ToastService);

  appMenu = signal<IMenu[]>(MENU);
  activeAccount = this.authService.activeAccount;
  activeRole = computed(() => this.activeAccount()?.role);

  hasOtherRoles = computed(() => {
    const roles = [
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ] as const;
    const otherRoles = this.activeAccount()?.otherRoles ?? [];

    return roles?.some((role) => otherRoles.includes(role));
  });

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

  expanded = signal<boolean>(window.innerWidth > 768);
  toggleSideNav = output<{ expanded: boolean }>();

  isActiveRoute(menu: IMenu): boolean {
    return this.router.url.includes(menu.route);
  }

  toggleSideBar() {
    this.expanded.update((val) => !val);
    this.toggleSideNav.emit({
      expanded: this.expanded(),
    });
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

    this.utils.showLoader();

    this.authService
      .switchRole(role)
      .pipe(finalize(() => this.utils.hideLoader()))
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

  logout() {
    this.authService.logOut();
  }
}
