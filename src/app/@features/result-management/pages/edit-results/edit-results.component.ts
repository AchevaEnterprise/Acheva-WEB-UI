import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, switchMap, throwError } from 'rxjs';
import { CanComponentDeactivate } from '../../../../@core/guards/pending-changes.guard';
import { ToastService } from '../../../../@core/utility/toast.service';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { RejectReasonComponent } from '../../../../@shared/components/reject-reason/reject-reason.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { AnalyticsChartComponent } from '../../../my-results/components/analytics-chart/analytics-chart.component';
import { RegularTableResultUploadComponent } from '../../../my-results/components/regular-table-result-upload/regular-table-result-upload.component';
import { IStudentGrade } from '../../../students/models/student.model';
import { ResendToCourseCoordinatorComponent } from '../../components/resend-to-course-coordinator/resend-to-course-coordinator.component';
import { ResendToDeanComponent } from '../../components/resend-to-dean/resend-to-dean.component';
import {
  ICreateResultEntry,
  IResult,
  ISendSelectedResult,
  SegmentValue,
} from '../../models/results.model';
import { ResultsService } from '../../services/results.service';
import {
  getApprovalHandoff,
  getRejectionHandoff,
  isResultReadonlyForLecturer,
  RECIPIENT_LABELS,
} from '../../utils/workflow';

@Component({
  selector: 'app-edit-results',
  imports: [
    RegularTableResultUploadComponent,
    SearchInputComponent,
    SegmentSwitcherComponent,
    AnalyticsChartComponent,
    MatDividerModule,
    MatTooltipModule,
    CardComponent,
    ButtonComponent,
    LoaderComponent,
    BackButtonComponent,
    MatMenuModule,
  ],
  templateUrl: './edit-results.component.html',
  styleUrl: './edit-results.component.scss',
})
export class EditResultsComponent implements OnInit, CanComponentDeactivate {
  private readonly authService = inject(AuthenticationService);
  private readonly resultsService = inject(ResultsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly resultId: string =
    this.route.snapshot.queryParamMap.get('resultId')!;
  readonly status: string = this.route.snapshot.queryParamMap.get('status')!;

  results = signal<IResult[]>([]);
  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);
  averageTotal = signal<number>(0);

  /** True while result + entries are loading; start true to avoid an empty first paint. */
  loadingResult = signal<boolean>(true);
  uploadingResult = signal<boolean>(false);
  approvingResult = signal<boolean>(false);
  rejectingResult = signal<boolean>(false);
  resending = signal<boolean>(false);
  tableExpanded = signal<boolean>(false);
  hasChanges = signal<boolean>(false);

  /**
   * A lecturer can open a result that has left their editable custody —
   * including a "second draft" forwarded to the CC while still in DRAFT status
   * — but only to view it. In that case the grade table is rendered read-only.
   * See `isResultReadonlyForLecturer` for the exact rule.
   */
  readOnly = signal<boolean>(false);

  userRole = this.authService.activeAccount()?.role;

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Regular',
      value: 'REGULAR',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Reference',
      value: 'REFERENCE',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Unregistered',
      value: 'UNREGISTERED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
  ]);

  activeSegment = signal<ISegmentSwitcher>(this.segments()[0]);

  result = signal<IResult | null>(null);
  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  RoleEnum = RoleEnum;

  ngOnInit(): void {
    this.getResultAndEntries();
  }

  getResultAndEntries() {
    this.loadingResult.set(true);

    const result$ = this.resultsService.getResult(this.resultId);
    const resultEntries$ = this.resultsService.getResultEntries(this.resultId, {
      category: this.activeSegment().value,
    });

    forkJoin([result$, resultEntries$])
      .pipe(finalize(() => this.loadingResult.set(false)))
      .subscribe({
        next: ([result, resultEntries]) => {
          if (result.status) {
            this.result.set(result.data);
            this.readOnly.set(
              this.userRole === RoleEnum.LECTURER &&
                isResultReadonlyForLecturer(result.data)
            );
          }
          if (resultEntries.status)
            this.setResultEntriesDetails(resultEntries.data);
        },
      });
  }

  setResultEntriesDetails(resultEntries: unknown) {
    const { analytics, totalPass, totalFail, entries, studentsWithoutEntries } =
      resultEntries as {
        analytics: Record<string, number>;
        total: number;
        totalPass: number;
        totalFail: number;
        entries: Partial<IStudentGrade>[];
        studentsWithoutEntries?: Partial<IStudentGrade>[];
      };

    const analyticsData = [
      analytics['A'] || 0,
      analytics['B'] || 0,
      analytics['C'] || 0,
      analytics['D'] || 0,
      analytics['E'] || 0,
      analytics['F'] || 0,
    ];

    const studentResultEntries = [
      ...entries,
      ...(studentsWithoutEntries ?? []),
    ];

    this.analyticsChartData.set(analyticsData);
    this.totalStudent.set(studentResultEntries.length);
    this.totalStudentPass.set(totalPass || 0);
    this.totalStudentFail.set(totalFail || 0);

    // Set student's result entries
    const activeCategory = this.activeSegment().value as SegmentValue;
    this.students.update((students) => {
      students[activeCategory] = studentResultEntries;
      return students;
    });
  }

  switchSegment(value: ISegmentSwitcher['value']): void {
    const selectedSegment: ISegmentSwitcher = this.segments()?.find(
      (segment: ISegmentSwitcher) => segment.value === value
    )!;
    this.activeSegment.set(selectedSegment);
    this.getResultAndEntries();
  }

  uploadBulkResult(results: IStudentGrade[]) {
    let resultEntries: ICreateResultEntry[] = [];

    for (const result of results)
      resultEntries.push({ ...result, result: this.resultId });

    this.resultsService.createBulkResultEntries(resultEntries).subscribe({
      next: (resp) => {
        if (!resp.status) {
          this.toast.showNotification('error', 'Upload Error', resp.message);
          return;
        }

        this.getResultAndEntries();
      },
    });
  }

  uploadResult(result: Partial<IStudentGrade>) {
    this.uploadingResult.set(true);

    const { registrationNumber, fullName, test, lab, exam, total } = result;
    const resultEntry: ICreateResultEntry = {
      registrationNumber: registrationNumber!,
      fullName: fullName!,
      test: test!,
      lab: lab!,
      exam: exam!,
      total: total!,
      result: this.resultId,
    };

    this.resultsService
      .createResultEntry(resultEntry)
      .pipe(finalize(() => this.uploadingResult.set(false)))
      .subscribe({
        next: (resp) => {
          if (!resp.status) {
            this.toast.showNotification('error', 'Upload Error', resp.message);
            return;
          }

          this.getResultAndEntries();
        },
      });
  }

  confirmApproval() {
    const result = this.result();
    const user = this.authService.activeAccount();
    if (!result || !user) return;

    const handoff = getApprovalHandoff(result, user.role as RoleEnum);
    if (!handoff) {
      this.toast.showNotification(
        'error',
        'Cannot Forward',
        'No valid recipient for this result at its current state.'
      );
      return;
    }

    const nextLabel = RECIPIENT_LABELS[handoff.role] ?? 'the next approver';
    const message = `You're about to send this vetted result to the ${nextLabel}. This action is irreversible. Are you sure you want to continue?`;

    if (result.isApproved === false) {
      this.dialog
        .open(ResendToDeanComponent, {
          width: '600px',
          data: {
            title: `Resend to ${nextLabel}`,
            resultId: this.resultId,
          },
        })
        .afterClosed()
        .subscribe({
          next: (outcome: {
            issueStatus: 'RESOLVED' | 'UNRESOLVED';
            comment: string;
          }) => {
            if (outcome) this.approve(outcome);
          },
        });
    } else {
      this.dialog
        .open(ConfirmationComponent, {
          width: '600px',
          data: { message },
        })
        .afterClosed()
        .subscribe({
          next: (confirmed: boolean) => {
            if (confirmed) this.approve();
          },
        });
    }
  }

  approve(meta?: { issueStatus: 'RESOLVED' | 'UNRESOLVED'; comment: string }) {
    const result = this.result() as IResult;
    const user = this.authService.activeAccount()!;
    const handoff = getApprovalHandoff(result, user.role as RoleEnum);

    if (!handoff) {
      this.toast.showNotification(
        'error',
        'Cannot Forward',
        'No valid recipient for this result at its current state.'
      );
      return;
    }

    this.approvingResult.set(true);

    this.resultsService
      .approveResult(this.resultId, meta?.comment, meta?.issueStatus)
      .pipe(
        switchMap((resp) => {
          if (resp.status) {
            return this.resultsService.sendResult(
              this.resultId,
              handoff.recipientId,
              handoff.role
            );
          }

          return throwError(() => {
            const error = new Error('Failed to approve result');
            return error;
          });
        }),
        finalize(() => this.approvingResult.set(false))
      )
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Approved & Sent',
              `Result has been sent and approved successfully`
            );

            this.router.navigate(['/result-management']);
          }
        },
        error: (error) => {
          this.toast.showNotification(
            'error',
            'Error Occured',
            error.error.message
          );
        },
      });
  }

  confirmReject() {
    const role = this.authService.activeAccount()!.role as RoleEnum;

    if (role === RoleEnum.HOD) {
      this.dialog
        .open(ResendToCourseCoordinatorComponent, {
          width: '600px',
          data: {
            resultId: this.resultId,
          },
        })
        .afterClosed()
        .subscribe({
          next: (comment: string) => {
            if (comment) this.reject(comment);
          },
        });
    } else {
      this.dialog
        .open(RejectReasonComponent, {
          width: '600px',
          data: { resultId: this.resultId },
        })
        .afterClosed()
        .subscribe({
          next: (comment: string) => {
            if (comment) this.reject(comment);
          },
        });
    }
  }

  reject(reason: string) {
    const result = this.result() as IResult;
    const user = this.authService.activeAccount()!;
    const handoff = getRejectionHandoff(result, user.role as RoleEnum);

    if (!handoff) {
      this.toast.showNotification(
        'error',
        'Cannot Reject',
        'You are not allowed to reject this result at its current state.'
      );
      return;
    }

    this.rejectingResult.set(true);

    this.resultsService
      .rejectResult(this.resultId, reason)
      .pipe(
        switchMap((resp) => {
          if (resp.status) {
            return this.resultsService.sendResult(
              this.resultId,
              handoff.recipientId,
              handoff.role
            );
          }

          return throwError(() => {
            const error = new Error('Failed to reject result');
            return error;
          });
        })
      )
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Rejected',
              `Result has been sent and rejected successfully`
            );

            this.router.navigate(['/result-management']);
          }
        },
        error: (error) => {
          this.toast.showNotification(
            'error',
            'Error Occured',
            error.error.message
          );
        },
      });
  }

  confirmResendToCC() {
    this.dialog
      .open(ResendToCourseCoordinatorComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToCC();
        },
      });
  }

  confirmResendToDean() {
    this.dialog
      .open(ResendToDeanComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.resendToDean();
        },
      });
  }

  private sendToCC() {
    this.resending.set(true);

    const payload: ISendSelectedResult[] = [
      {
        resultId: this.resultId,
        recipient: this.result()?.roles.COURSE_COORDINATOR || '',
      },
    ];

    this.resultsService
      .sendSelectedResult(payload, RoleEnum.COURSE_COORDINATOR)
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const { failedCount, sentCount, failed } = resp.data as {
              failedCount: number;
              sentCount: number;
              failed: unknown[];
            };
            const totalCount = failedCount + sentCount;

            if (failedCount > 0) {
              this.toast.showNotification(
                'error',
                'Some Results Failed',
                `${failedCount} of ${totalCount} results failed to be sent, ${(failed[0] as { error: string }).error}`
              );
            } else {
              this.toast.showNotification(
                'success',
                'Result Sent',
                'Result has been sent to the Course Cordinator'
              );
            }

            this.getResultAndEntries();
          }
        },
      });
  }

  resendToDean() {
    this.resending.set(true);

    const payload: ISendSelectedResult[] = [
      {
        resultId: this.resultId,
        recipient: this.result()?.roles.DEAN || '',
      },
    ];

    this.resultsService
      .sendSelectedResult(payload, RoleEnum.DEAN)
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Result has been re-sent to the Dean'
            );

            this.getResultAndEntries();
          }
        },
      });
  }

  toggleTableView() {
    this.tableExpanded.set(!this.tableExpanded());
  }

  updateChanges(hasChanges: boolean) {
    this.hasChanges.set(hasChanges);
  }

  canDeactivate(): boolean {
    if (!this.hasChanges()) {
      return true;
    }

    return confirm(
      'You have unsaved changes. Are you sure you want to leave this page?'
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    if (this.hasChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
