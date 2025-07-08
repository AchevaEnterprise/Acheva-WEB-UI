import { Component, computed, inject, output, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  COURSE_ADVISOR_MENU,
  COURSE_CORDINATOR_MENU,
} from '../../@core/constant/menu';
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
  ],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthenticationService);

  appMenu = computed(() => {
    const account = this.authService.activeAccount();
    if (!account) return COURSE_ADVISOR_MENU; // TODO: Should be changed to an empty array once integrations/logic is implemented

    switch (account.role) {
      case 'advisor':
        return COURSE_ADVISOR_MENU;
      case 'cordinator':
        return COURSE_CORDINATOR_MENU;
      default:
        return COURSE_ADVISOR_MENU; // TODO: Should be changed to an empty array once integrations/logic is implemented
    }
  });

  // TODO: Make a popover that shows other accounts
  accounts = this.authService.accounts();

  expanded = signal<boolean>(true);
  onToggleSideNav = output<{ expanded: boolean }>();

  isActiveRoute = computed(() =>
    this.appMenu()?.some((menu: IMenu) => this.router.url.includes(menu.route))
  );

  toggleSideBar() {
    this.expanded.update((val) => !val);
    this.onToggleSideNav.emit({
      expanded: this.expanded(),
    });
  }

  switchAccount(accountId: string) {
    this.authService.switchAccount(accountId).subscribe(() => {
      this.router.navigate(['/dashboard']);
    });
  }
}
