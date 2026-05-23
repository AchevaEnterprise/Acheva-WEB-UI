import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type AiInsightVariant = 'warning' | 'success' | 'info';

@Component({
  selector: 'app-ai-insight-card',
  imports: [MatIconModule],
  templateUrl: './ai-insight-card.component.html',
  styleUrl: './ai-insight-card.component.scss',
})
export class AiInsightCardComponent {
  title = input.required<string>();
  description = input<string>('');
  variant = input<AiInsightVariant>('info');
  /** When true the card becomes interactive (cursor + hover + a11y). */
  interactive = input<boolean>(false);

  clickEvent = output<void>();

  variantClass = computed(() => `variant-${this.variant()}`);

  // Default icon per variant; consumers don't need to think about it. We
  // prefer icons that exist in the classic Material Icons font shipped via
  // Google Fonts (loaded in index.html) for guaranteed render.
  icon = computed(() => {
    switch (this.variant()) {
      case 'warning':
        return 'warning';
      case 'success':
        return 'flag';
      default:
        return 'info';
    }
  });

  onActivate(): void {
    if (this.interactive()) this.clickEvent.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.interactive()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.clickEvent.emit();
    }
  }
}
