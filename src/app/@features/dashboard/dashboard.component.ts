import { DatePipe } from '@angular/common';
import { Component, inject, model, signal } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule, MatPrefix } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RoleAccessDirective } from '../../@core/directives/role-access.directive';
import { IAnalytics } from '../../@core/models/school.model';
import { GreetingPipe } from '../../@core/pipes/greeting.pipe';
import { CardComponent } from '../../@shared/components/card/card.component';
import { EmptyStateComponent } from '../../@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '../../@shared/components/forms/search-input/search-input.component';
import { PaginatorComponent } from '../../@shared/components/paginator/paginator.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../@shared/components/segment-switcher/segment-switcher.component';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { RoleEnum } from '../auth/model/auth.model';
import { AuthenticationService } from '../auth/service/auth.service';
import { ICourse } from '../courses/models/course.model';
import {
  ActivityComponent,
  IActivity,
} from './components/activity/activity.component';
import { AnalyticsCardComponent } from './components/analytics-card/analytics-card.component';
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
    SearchInputComponent,
    PaginatorComponent,
    RoleAccessDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly authService = inject(AuthenticationService);
  analtyics = signal<IAnalytics[]>([
    {
      label: 'Drafts',
      count: 0,
      iconSrc: 'images/general/dash-card-draft.svg',
      infoLabel: 'Results that are being compiled',
      accessRole: [RoleEnum.LECTURER, RoleEnum.COURSE_COORDINATOR],
    },
    {
      label: 'Pending',
      count: 0,
      iconSrc: 'images/general/dash-card-pending.svg',
      infoLabel: "Results awaiting HOD's approval",
      accessRole: [
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Unverified',
      count: 0,
      iconSrc: 'images/general/dash-card-unverified.svg',
      infoLabel: "Results awaiting Dean's approval",
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Verified',
      count: 0,
      iconSrc: 'images/general/dash-card-verified.svg',
      infoLabel: 'Results verified by the Dean',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Approved',
      count: 0,
      iconSrc: 'images/general/dash-card-pending.svg',
      infoLabel: 'Results in post-Dean approval (workflow)',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Complete',
      count: 0,
      iconSrc: 'images/general/dash-card-published.svg',
      infoLabel: 'Results fully approved, ready to publish',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Published',
      count: 0,
      iconSrc: 'images/general/dash-card-published.svg',
      infoLabel: 'Results published by the CA',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Imported',
      count: 0,
      iconSrc: 'images/general/dash-card-imported.svg',
      infoLabel: 'Results imported / manually processed',
      accessRole: [RoleEnum.DEAN, RoleEnum.HOD, RoleEnum.COURSE_ADVISOR],
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
  dataSource = signal<ICourse[]>([]);

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Draft',
      value: 'DRAFT',
      accessRole: [RoleEnum.LECTURER, RoleEnum.COURSE_COORDINATOR],
    },
    {
      label: 'Pending',
      value: 'PENDING',
      accessRole: [
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Unverified',
      value: 'UNVERIFIED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Verified',
      value: 'VERIFIED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Approved',
      value: 'APPROVED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Complete',
      value: 'COMPLETE',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Published',
      value: 'PUBLISHED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Imported',
      value: 'IMPORTED',
      accessRole: [RoleEnum.DEAN, RoleEnum.HOD, RoleEnum.COURSE_ADVISOR],
    },
  ]);
  activeSegment = signal<ISegmentSwitcher>(this.segments()[0]);
  selectedCalendarDate = model<number>(Date.now());
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');

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

  activeAccount = this.authService.activeAccount;

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
      case 'DRAFT': {
        this.segmentCardLabel.set('Access your recent drafts from here');
        this.segmentCardIconSrc.set('icons/general/draft-icon.svg');
        break;
      }
      case 'PENDING': {
        this.segmentCardLabel.set('Access your pending results from here');
        this.segmentCardIconSrc.set('icons/general/pending-icon.svg');
        break;
      }
      case 'UNVERIFIED': {
        this.segmentCardLabel.set('Access your unverified results from here');
        this.segmentCardIconSrc.set('icons/general/unverified-icon.svg');
        break;
      }
      case 'VERIFIED': {
        this.segmentCardLabel.set('Access your verified results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'APPROVED': {
        this.segmentCardLabel.set('Access approved results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'COMPLETE': {
        this.segmentCardLabel.set('Access complete results ready to publish');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
      case 'PUBLISHED': {
        this.segmentCardLabel.set('Access your published results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
      case 'IMPORTED': {
        this.segmentCardLabel.set('Access imported results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
    }
  }
}
