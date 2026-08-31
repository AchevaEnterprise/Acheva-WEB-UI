import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A single shimmering skeleton block — the primitive for all loading states.
 * Compose several to mirror the real content's layout (text lines, cards,
 * table rows) rather than showing a spinner: it hints at the shape of what's
 * loading and reads as faster.
 *
 * @example
 * <app-skeleton width="40%" height="1rem" />
 * <app-skeleton width="2.5rem" height="2.5rem" [circle]="true" />
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styleUrl: './skeleton.component.scss',
  host: {
    class: 'app-skeleton',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.border-radius]': "circle() ? '50%' : radius()",
    'aria-hidden': 'true',
  },
})
export class SkeletonComponent {
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');
  readonly radius = input<string>('8px');
  readonly circle = input<boolean>(false);
}
