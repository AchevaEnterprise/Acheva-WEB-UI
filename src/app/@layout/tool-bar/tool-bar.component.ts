import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { filter } from 'rxjs';
import { UtilityService } from '../../@core/utility/utility.service';
import { MatBadgeModule } from '@angular/material/badge';

@Component({
  selector: 'app-tool-bar',
  imports: [SvgComponent, ImageFallbackDirective, MatBadgeModule],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly utillityService = inject(UtilityService);

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
}
