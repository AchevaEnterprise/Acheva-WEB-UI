import { Component, input } from '@angular/core';
import { IAnalytics } from '../../../../@core/models/school.model';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-analytics-card',
  imports: [SvgComponent],
  templateUrl: './analytics-card.component.html',
  styleUrl: './analytics-card.component.scss',
})
export class AnalyticsCardComponent {
  analtyics = input<IAnalytics>();
}
