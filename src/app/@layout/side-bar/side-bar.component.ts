import { Component, inject, OnInit, output, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';

import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MENU } from '../../@core/constant/menu';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { IMenu } from '../../@core/models/menu.model';
import { IAccount, RoleEnum } from '../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { RoleAccessDirective } from '../../@core/directives/role-access.directive';

@Component({
  selector: 'app-side-bar',
  imports: [
    RouterLink,
    RouterLinkActive,
    SvgComponent,
    MatDividerModule,
    ImageFallbackDirective,
    RoleAccessDirective,
  ],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);

  ngOnInit() {
    // Remove immediate API call to prevent auth loop
  }

  switchAccountEvent = output<string>();

  appMenu = signal<IMenu[]>(MENU);
  accounts = this.authService.accounts;
  activeAccount = this.authService.activeAccount;
  linkedAccounts = signal<IAccount[]>([]);

  RoleEnum = RoleEnum;

  expanded = signal<boolean>(window.innerWidth > 768);
  showRolePopup = signal<boolean>(false);
  onToggleSideNav = output<{ expanded: boolean }>();

  isActiveRoute(menu: IMenu): boolean {
    return this.router.url.includes(menu.route);
  }

  toggleSideBar() {
    this.expanded.update((val) => !val);
    this.onToggleSideNav.emit({
      expanded: this.expanded(),
    });
  }

  loadLinkedAccounts() {
    this.authService.getLinkedAccounts().subscribe({
      next: (response) => {
        if (response.status) {
          this.linkedAccounts.set(response.data);
        }
      },
      error: (error) => {
        console.error('Failed to load linked accounts:', error);
      },
    });
  }

  getAvailableRoles() {
    return this.linkedAccounts().filter(
      (account) => account.role !== this.activeAccount()?.role
    );
  }

  hasCourseCoordinatorRole() {
    const account = this.activeAccount();
    if (!account) return false;
    return (
      account.role === RoleEnum.COURSE_COORDINATOR ||
      (account as any).otherRoles?.includes(RoleEnum.COURSE_COORDINATOR)
    );
  }

  isRoleAssigned(role: RoleEnum) {
    const account = this.activeAccount();
    if (!account) return false;

    // Lecturer is always assigned
    if (role === RoleEnum.LECTURER) return true;

    // Check if it's the current role or in otherRoles
    return account.role === role || (account as any).otherRoles?.includes(role);
  }

  switchToRole(role: RoleEnum) {
    this.authService.switchRole(role).subscribe({
      next: (response) => {
        if (response.status) {
          this.closeRolePopup();
          window.location.reload();
        }
      },
      error: (error) => {
        console.error('Failed to switch role:', error);
      },
    });
  }

  switchAccount(accountId: string) {
    this.authService.switchAccount(accountId).subscribe({
      next: (response) => {
        if (response.status) {
          this.switchAccountEvent.emit(accountId);
          this.closeRolePopup();
        }
      },
      error: (error) => {
        console.error('Failed to switch account:', error);
      },
    });
  }

  toggleRolePopup() {
    this.showRolePopup.update((val) => !val);
  }

  closeRolePopup() {
    this.showRolePopup.set(false);
  }

  logout() {
    this.authService.logOut();
  }
}
