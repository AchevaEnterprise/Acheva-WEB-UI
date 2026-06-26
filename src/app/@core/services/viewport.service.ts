import { Injectable, signal } from '@angular/core';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class ViewportService {
  private readonly isBelowLgBreakpoint = signal(this.isSmallViewport());
  readonly viewportWidth = signal(window.innerWidth);

  constructor() {
    fromEvent(window, 'resize')
      .pipe(debounceTime(100), takeUntilDestroyed())
      .subscribe(() => {
        this.viewportWidth.set(window.innerWidth);
        this.isBelowLgBreakpoint.set(this.isSmallViewport());
      });
  }

  private isSmallViewport(): boolean {
    return window.innerWidth < 1024;
  }

  /**
   * Returns true when viewport is below lg breakpoint (1024px)
   * Automatically collapses multi-column layouts on mobile/tablet
   */
  shouldCollapse(): boolean {
    return this.isBelowLgBreakpoint();
  }
}
