import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IAnalytics } from '../../../../@core/models/school.model';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-analytics-card',
  imports: [SvgComponent],
  templateUrl: './analytics-card.component.html',
  styleUrl: './analytics-card.component.scss',
})
export class AnalyticsCardComponent {
  private readonly router = inject(Router);

  analtyics = input<IAnalytics>();

  onCardClick() {
    const tab = this.analtyics()?.resultTab;
    if (!tab) return;
    void this.router.navigate(['/result-management'], {
      queryParams: { tab },
    });
  }

  onCardKeydown(event: KeyboardEvent) {
    if (!this.analtyics()?.resultTab) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.onCardClick();
  }
}
