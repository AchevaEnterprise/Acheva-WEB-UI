import { Component, input } from '@angular/core';
import { IAnalytics } from '../../../../@core/models/school.model';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-due-analytics',
  imports: [SvgComponent],
  templateUrl: './due-analytics.component.html',
  styleUrl: './due-analytics.component.scss',
})
export class DueAnalyticsComponent {
  analtyics = input<Partial<IAnalytics>>();
}
