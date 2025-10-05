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
    this.loadLinkedAccounts();
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
    return this.linkedAccounts().some(
      (account) => account.role === RoleEnum.COURSE_COORDINATOR
    );
  }

  switchAccount(accountId: string) {
    this.authService.switchAccount(accountId).subscribe({
      next: (response) => {
        if (response.status) {
          this.switchAccountEvent.emit(accountId);
          this.closeRolePopup();

          // Redirect to appropriate dashboard based on role
          if (response.data.role === RoleEnum.COURSE_COORDINATOR) {
            this.router.navigate(['/course-coordinator/dashboard']);
          }
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
