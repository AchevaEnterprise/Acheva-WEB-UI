import { Component, effect, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { UtilityService } from './@core/utility/utility.service';
import { DesktopOnlyViewComponent } from './@shared/components/desktop-only-view/desktop-only-view.component';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatProgressBarModule, DesktopOnlyViewComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly utils = inject(UtilityService);
  private readonly MIN_WIDTH = 1000;

  isDesiredWidth = signal(window.innerWidth >= this.MIN_WIDTH);

  constructor() {
    effect((onCleanup) => {
      const handler = () =>
        this.isDesiredWidth.set(window.innerWidth >= this.MIN_WIDTH);

      window.addEventListener('resize', handler);

      onCleanup(() => window.removeEventListener('resize', handler));
    });
  }
}
