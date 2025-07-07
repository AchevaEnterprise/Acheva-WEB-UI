import { Component, model, signal } from '@angular/core';
import { MatFormFieldModule, MatPrefix } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EmptyStateComponent } from '../../@shared/components/empty-state/empty-state.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../@shared/components/segment-switcher/segment-switcher.component';
import {
  AnalyticsCardComponent,
  IAnalytics,
} from './components/analytics-card/analytics-card.component';
import { CardComponent } from './components/card/card.component';
import { ChartComponent } from './components/chart/chart.component';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { ButtonComponent } from '../../@shared/components/forms/button/button.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    AnalyticsCardComponent,
    CardComponent,
    ChartComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    SegmentSwitcherComponent,
    EmptyStateComponent,
    MatDatepickerModule,
    MatPrefix,
    SvgComponent,
    ButtonComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  analtyics = signal<IAnalytics[]>([
    {
      label: 'Drafts',
      count: 0,
      iconSrc: 'images/general/dash-card-draft.svg',
      infoLabel: 'Results that are being compiled',
    },
    {
      label: 'Pending Results',
      count: 0,
      iconSrc: 'images/general/dash-card-pending.svg',
      infoLabel: 'Results awaiting HOD’s approval',
    },
    {
      label: 'Unverified',
      count: 0,
      iconSrc: 'images/general/dash-card-unverified.svg',
      infoLabel: "Results awaiting Dean's approval",
    },
    {
      label: 'Verified',
      count: 0,
      iconSrc: 'images/general/dash-card-verified.svg',
      infoLabel: 'Results approved by the Dean',
    },
    {
      label: 'Published',
      count: 0,
      iconSrc: 'images/general/dash-card-published.svg',
      infoLabel: 'Results published by the CA',
    },
  ]);

  activeSegment = signal<ISegmentSwitcher>({
    label: 'Drafts',
    value: 'drafts',
  });
  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Drafts',
      value: 'drafts',
    },
    {
      label: 'Pending',
      value: 'pending',
    },
    {
      label: 'Unverified',
      value: 'unverified',
    },
    {
      label: 'Verified',
      value: 'verified',
    },
    {
      label: 'Published',
      value: 'published',
    },
  ]);

  selectedCalendarDate = model<number>(Date.now());

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );
  }
}
