import { DatePipe } from '@angular/common';
import { Component, model, signal } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule, MatPrefix } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { COURSES } from '../../@core/constant/course-mock';
import { ICourse } from '../../@core/models/course.model';
import { GreetingPipe } from '../../@core/pipes/greeting.pipe';
import { EmptyStateComponent } from '../../@shared/components/empty-state/empty-state.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../@shared/components/segment-switcher/segment-switcher.component';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import {
  ActivityComponent,
  IActivity,
} from './components/activity/activity.component';
import {
  AnalyticsCardComponent,
  IAnalytics,
} from './components/analytics-card/analytics-card.component';
import { CardComponent } from './components/card/card.component';
import { ChartComponent } from './components/chart/chart.component';

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
    ActivityComponent,
    MatTableModule,
    MatMenuModule,
    SvgComponent,
    DatePipe,
    GreetingPipe,
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
      infoLabel: "Results awaiting HOD's approval",
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

  displayedColumns: string[] = [
    'courseCode',
    'courseTitle',
    'session',
    'department',
    'faculty',
    'uploadedDate',
    'sentDate',
    'actions',
  ];
  dataSource = signal<ICourse[]>(COURSES);

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

  activities = signal<IActivity[]>([
    {
      type: 'submit',
      message:
        'Database Management System (CSC 301) results has been submitted',
      date: new Date(),
    },
    {
      type: 'add',
      message: 'Created new course: Software Engineering (CSC 401)',
      date: new Date(),
    },
    {
      type: 'reminder',
      message: 'Reminder: Software Engineering (CSC 401) results due in 4 days',
      date: new Date(),
    },
    {
      type: 'add',
      message: 'Created new course: Software Engineering (CSC 401)',
      date: new Date(),
    },
    {
      type: 'edit',
      message:
        'Updated scores for 4 Students in Software Engineering (CSC 401)',
      date: new Date(),
    },
  ]);

  selectedCalendarDate = model<number>(Date.now());
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
      case 'drafts': {
        this.segmentCardLabel.set('Access your recent drafts from here');
        this.segmentCardIconSrc.set('icons/general/draft-icon.svg');
        break;
      }
      case 'pending': {
        this.segmentCardLabel.set('Access your pending results from here');
        this.segmentCardIconSrc.set('icons/general/pending-icon.svg');
        break;
      }
      case 'unverified': {
        this.segmentCardLabel.set('Access your unverified results from here');
        this.segmentCardIconSrc.set('icons/general/unverified-icon.svg');
        break;
      }
      case 'verified': {
        this.segmentCardLabel.set('Access your verified results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'published': {
        this.segmentCardLabel.set('Access your published results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
    }
  }
}
