import {
  Component,
  inject,
  model,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { finalize, forkJoin, map, switchMap } from 'rxjs';
import { RoleAccessDirective } from '../../@core/directives/role-access.directive';
import { IPaginator } from '../../@core/models/paginator.model';
import { IAnalytics } from '../../@core/models/school.model';
import { GreetingPipe } from '../../@core/pipes/greeting.pipe';
import { AppState } from '../../@core/store/app.state';
import { notificationSelector } from '../../@core/store/notification/notification.selector';
import { ToastService } from '../../@core/utility/toast.service';
import { CardComponent } from '../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../@shared/components/confirmation/confirmation.component';
import { EmptyStateComponent } from '../../@shared/components/empty-state/empty-state.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../auth/model/auth.model';
import { AuthenticationService } from '../auth/service/auth.service';
import { INotification } from '../notifications/models/notification.model';
import { ResultManagementFileTableComponent } from '../result-management/components/result-management-file-table/result-management-file-table.component';
import { ResultManagementFolderTableComponent } from '../result-management/components/result-management-folder-table/result-management-folder-table.component';
import {
  IGroupedResult,
  IResult,
} from '../result-management/models/results.model';
import { ResultsService } from '../result-management/services/results.service';
import { ActivityComponent } from './components/activity/activity.component';
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
    MatTableModule,
    MatMenuModule,
    GreetingPipe,
    RoleAccessDirective,
    ResultManagementFileTableComponent,
    ResultManagementFolderTableComponent,
    ActivityComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly resultService = inject(ResultsService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store<AppState>);

  currentRole = signal<RoleEnum>(this.authService.activeAccount()?.role!);
  loadingResults = signal<boolean>(false);
  RoleEnum = RoleEnum;

  analtyics = signal<IAnalytics[]>([
    {
      label: 'Drafts',
      count: 0,
      iconSrc: 'images/general/dash-card-draft.svg',
      infoLabel: 'Results that are being compiled',
      accessRole: [RoleEnum.LECTURER, RoleEnum.COURSE_COORDINATOR],
      resultTab: 'DRAFT',
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
      resultTab: 'PENDING',
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
      resultTab: 'UNVERIFIED',
    },
    // Course Advisor only enters the workflow at COMPLETE; see segments below.
    {
      label: 'Verified',
      count: 0,
      iconSrc: 'images/general/dash-card-verified.svg',
      infoLabel: 'Results verified by the Dean',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
      resultTab: 'VERIFIED',
    },
    {
      label: 'Approved',
      count: 0,
      iconSrc: 'images/general/dash-card-pending.svg',
      infoLabel: 'Results awaiting the offering department HOD',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
      resultTab: 'APPROVED',
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
      resultTab: 'COMPLETE',
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
      resultTab: 'PUBLISHED',
    },
    {
      label: 'Imported',
      count: 0,
      iconSrc: 'images/general/dash-card-imported.svg',
      infoLabel: 'Results imported / manually processed',
      accessRole: [RoleEnum.DEAN, RoleEnum.HOD, RoleEnum.COURSE_ADVISOR],
      resultTab: 'IMPORTED',
    },
  ]);

  fileTableRef = viewChild<ResultManagementFileTableComponent>('fileTableRef');
  folderTableRef =
    viewChild<ResultManagementFolderTableComponent>('folderTableRef');

  result = signal<IResult | null>(null);
  results = signal<IResult[]>([]);
  groupedResults = signal<IGroupedResult[]>([]);

  pagination = signal<IPaginator>({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Drafts',
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
  activeSegment = signal<ISegmentSwitcher>(this.resolveInitialSegment());
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');
  chart = signal<{ courseCode: string; passRate: number; failRate: number }[]>(
    []
  );

  selectedCalendarDate = model<number>(Date.now());
  activities = signal<INotification[]>([]);
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

    this.getResults();
  }

  ngOnInit(): void {
    this.getDashboardAnalytics();
    this.getFirstFiveResultCharts();
    this.getActivities();

    if (this.currentRole() === RoleEnum.COURSE_COORDINATOR) {
      this.getGroupedResults();
    } else {
      this.switchSegment(this.activeSegment().value);
    }
  }

  /**
   * Landing tab per role. CA always lands on COMPLETE because that is the
   * only pre-publish state they can act on after the HOD → CA handoff.
   */
  private resolveInitialSegment(): ISegmentSwitcher {
    const role = this.currentRole();
    const preferredByRole: Partial<Record<RoleEnum, ISegmentSwitcher['value']>> = {
      [RoleEnum.HOD]: 'PENDING',
      [RoleEnum.DEAN]: 'UNVERIFIED',
      [RoleEnum.COURSE_ADVISOR]: 'COMPLETE',
      [RoleEnum.LECTURER]: 'DRAFT',
      [RoleEnum.COURSE_COORDINATOR]: 'DRAFT',
    };
    const preferred = preferredByRole[role];
    const segments = this.segments();
    return (
      segments.find(
        (s) => s.value === preferred && s.accessRole?.includes(role),
      ) ??
      segments.find((s) => s.accessRole?.includes(role)) ??
      segments[0]
    );
  }

  getDashboardAnalytics() {
    this.resultService.getResultStatusCounts().subscribe({
      next: (resp) => {
        if (resp.status) {
          const { statusCounts } = resp.data;

          const updatedAnalytics = this.analtyics().map(
            (analytics: IAnalytics) => {
              let count = analytics.count;
              const label = analytics.label.toLowerCase();

              if (label.includes('draft')) count = statusCounts.DRAFT;
              else if (label.includes('pending')) count = statusCounts.PENDING;
              else if (label.includes('unverified'))
                count = statusCounts.UNVERIFIED;
              else if (label.includes('verified'))
                count = statusCounts.VERIFIED;
              else if (label.includes('approved'))
                count = statusCounts.APPROVED ?? 0;
              else if (label.includes('complete'))
                count = statusCounts.COMPLETE ?? 0;
              else if (label.includes('published'))
                count = statusCounts.PUBLISHED;
              else if (label.includes('imported'))
                count = statusCounts.IMPORTED;

              return {
                ...analytics,
                count,
              };
            }
          );

          this.analtyics.set(updatedAnalytics);
        }
      },
    });
  }

  getResults() {
    this.loadingResults.set(true);

    this.resultService
      .getResults({
        status: this.activeSegment().value,
      })
      .pipe(finalize(() => this.loadingResults.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const { page, limit, total, result } = resp.data;

            this.pagination.update((prev: IPaginator) => {
              prev.page = page;
              prev.pageSize = limit;
              prev.total = total;

              return prev;
            });
            this.results.set(result);
          }
        },
      });
  }

  getGroupedResults() {
    this.loadingResults.set(true);

    this.resultService
      .getGroupResults()
      .pipe(finalize(() => this.loadingResults.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.groupedResults.set(resp.data.data);
          }
        },
      });
  }

  getFirstFiveResultCharts() {
    this.resultService
      .getResults()
      .pipe(
        switchMap((resp) => {
          const { result } = resp.data;

          const firstFive = result.slice(0, 5);

          const requests = firstFive.map((res: IResult) =>
            this.resultService.getResultEntries(res._id).pipe(
              map((entriesResp) => ({
                courseCode: res.course.courseCode,
                entries: entriesResp.data,
              }))
            )
          );

          return forkJoin(requests);
        })
      )
      .subscribe({
        next: (results) => {
          const analytics = results.map((item) => {
            const entries = item.entries as {
              totalPass: number;
              totalFail: number;
              total: number;
            };
            return {
              courseCode: item.courseCode,
              passRate: (entries.totalPass / entries.total) * 100,
              failRate: (entries.totalFail / entries.total) * 100,
            };
          });

          this.chart.set(analytics);
        },
      });
  }

  viewResult(result: IResult) {
    const { _id, status } = result;

    this.router.navigate(['/result-management/edit-results'], {
      queryParams: { resultId: _id, status },
    });
  }

  trackResult(result: IResult | null) {
    this.result.set(result);
  }

  deleteResult(result: IResult) {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: 'Are you sure you want to delete this result?',
          subTitle: 'Kindly confirm this action',
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirm: boolean) => {
          if (confirm) {
            this.resultService.deleteResult(result._id).subscribe({
              next: (resp) => {
                if (resp.status) {
                  this.toast.showNotification(
                    'success',
                    'Result Deleted',
                    'Result deleted successfully'
                  );

                  this.getResults();
                }
              },
            });
          }
        },
      });
  }

  viewFolder(result: IGroupedResult) {
    const { course, session } = result;

    this.router.navigate(['/result-management/view-results'], {
      queryParams: {
        courseId: course,
        status: this.activeSegment().value,
        session,
      },
    });
  }

  getActivities() {
    this.store.select(notificationSelector).subscribe({
      next: (notifications) => {
        this.activities.set(notifications);
      },
    });
  }
}
