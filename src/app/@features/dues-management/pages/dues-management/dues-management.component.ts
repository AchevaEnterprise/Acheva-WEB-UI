import { Component, signal } from '@angular/core';
import { IAnalytics, LevelsEnum } from '../../../../@core/models/school.model';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { DueAnalyticsComponent } from '../../components/due-analytics/due-analytics.component';
import { MatTableModule } from '@angular/material/table';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-dues-management',
  imports: [
    DueAnalyticsComponent,
    SegmentSwitcherComponent,
    PaginatorComponent,
    MatTableModule,
    DatePipe,
  ],
  templateUrl: './dues-management.component.html',
  styleUrl: './dues-management.component.scss',
})
export class DuesManagementComponent {
  analtyics = signal<Partial<IAnalytics>[]>([
    {
      label: 'Paid',
      count: 0,
      iconSrc: 'images/general/dash-card-draft.svg',
      infoLabel: 'Number of students that have paid departmental dues',
    },
    {
      label: 'Unpaid',
      count: 0,
      iconSrc: 'images/general/dash-card-pending.svg',
      infoLabel: 'Number of students yet to pay departmental dues',
    },
    {
      label: 'Total Revenue',
      count: 0,
      iconSrc: 'images/general/dash-card-unverified.svg',
      infoLabel: 'Total amount gotten from departmental dues',
    },
    {
      label: 'Total Student',
      count: 0,
      iconSrc: 'images/general/dash-card-verified.svg',
      infoLabel: 'Total Number of students in this level',
    },
  ]);

  segments = signal<ISegmentSwitcher[]>([
    {
      label: '100L',
      value: LevelsEnum.YEAR_ONE,
    },
    {
      label: '200L',
      value: LevelsEnum.YEAR_TWO,
    },
    {
      label: '300L',
      value: LevelsEnum.YEAR_THREE,
    },
    {
      label: '400L',
      value: LevelsEnum.YEAR_FOUR,
    },
    {
      label: '500L',
      value: LevelsEnum.YEAR_FIVE,
    },
    {
      label: '600L',
      value: LevelsEnum.YEAR_SIX,
    },
  ]);
  activeSegment = signal<ISegmentSwitcher>(this.segments()[0]);

  displayedColumns: string[] = [
    'studentName',
    'regNo',
    'session',
    'amountPaid',
    'paymentStatus',
    'receiptNo',
    'paymentDate',
  ];
  dataSource = signal<any[]>([]);

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
    }
  }
}
