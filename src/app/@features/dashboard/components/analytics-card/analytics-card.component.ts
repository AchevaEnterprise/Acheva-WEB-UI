import { Component, input } from '@angular/core';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

export interface IAnalytics {
  label: string;
  count: number;
  iconSrc: string;
  infoLabel: string;
}

@Component({
  selector: 'app-analytics-card',
  imports: [SvgComponent],
  templateUrl: './analytics-card.component.html',
  styleUrl: './analytics-card.component.scss',
})
export class AnalyticsCardComponent {
  analtyics = input<IAnalytics>();
}
