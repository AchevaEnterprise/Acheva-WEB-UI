import { Component, computed, inject, output, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MENU } from '../../@core/constant/menu';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { IMenu } from '../../@core/models/menu.model';
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
    // RoleAccessDirective,
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

  expanded = signal<boolean>(window.innerWidth > 768);
  onToggleSideNav = output<{ expanded: boolean }>();

  isActiveRoute = computed(() =>
    this.appMenu()?.some((menu: IMenu) =>
      this.router.url.startsWith(menu.route)
    )
  );

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
