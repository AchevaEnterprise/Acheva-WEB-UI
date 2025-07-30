import { Component, inject, output, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { UtilityService } from '../../@core/utility/utility.service';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

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
export class ToolBarComponent {
  private readonly authService = inject(AuthenticationService);
  private readonly utillityService = inject(UtilityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  switchAccountEvent = output<string>();
  accounts = this.authService.accounts;

  pageTitle = signal<string>('');
  badgeCount = signal<string>(this.utillityService.formatCount(10));

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
        },
      });
  }

  switchAccount(accountId: string) {
    this.switchAccountEvent.emit(accountId);
  }
}
