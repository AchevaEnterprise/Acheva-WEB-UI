import { Component, inject, output, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MENU } from '../../@core/constant/menu';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { IMenu } from '../../@core/models/menu.model';
import { RoleEnum } from '../../@features/auth/model/auth.model';
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
    MatMenuModule,
  ],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);

  switchAccountEvent = output<string>();

  appMenu = signal<IMenu[]>(MENU);
  accounts = this.authService.accounts;
  activeAccount = this.authService.activeAccount;

  RoleEnum = RoleEnum;

  expanded = signal<boolean>(window.innerWidth > 768);
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

  switchAccount(accountId: string) {
    this.switchAccountEvent.emit(accountId);
  }

  logout() {
    this.authService.logOut();
  }
}
