import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, switchMap, throwError } from 'rxjs';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { CommentComponent } from '../../../../@shared/components/forms/comment/comment.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { RejectReasonComponent } from '../../../../@shared/components/reject-reason/reject-reason.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { AnalyticsChartComponent } from '../../../my-results/components/analytics-chart/analytics-chart.component';
import { ResultManagementFileTableComponent } from '../../components/result-management-file-table/result-management-file-table.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';
import { IResult, ISendSelectedResult } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-view-results',
  imports: [
    NgClass,
    ResultManagementFileTableComponent,
    SearchInputComponent,
    AnalyticsChartComponent,
    MatDividerModule,
    MatTooltipModule,
    CardComponent,
    RoleAccessDirective,
    ButtonComponent,
    BackButtonComponent,
    ResultStatusTrackingComponent,
    CommentComponent,
  ],
  templateUrl: './view-results.component.html',
  styleUrl: './view-results.component.scss',
})
export class ViewResultsComponent implements OnInit {
  private readonly resultsService = inject(ResultsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthenticationService);

  readonly courseId: string =
    this.route.snapshot.queryParamMap.get('courseId')!;
  readonly session: string = this.route.snapshot.queryParamMap.get('session')!;
  readonly status: string = this.route.snapshot.queryParamMap.get('status')!;

  currentRole = signal<RoleEnum>(this.authService.activeAccount()?.role!);

  result = signal<IResult | null>(null);
  results = signal<IResult[]>([]);
  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);
  averageTotal = signal<number>(0);
  tableExpanded = signal<boolean>(false);

  /** Pass/fail rate — calculated on the backend, set from the analytics response. */
  percentagePass = signal<number>(0);
  percentageFail = signal<number>(0);

  pagination = signal<IPaginator>({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  /** Start true so the file table shows a loader on first paint (before ngOnInit). */
  loadingResult = signal<boolean>(true);
  sendingToHOD = signal<boolean>(false);
  sendingToLecturer = signal<boolean>(false);
  refreshComments = signal<boolean>(false);
  RoleEnum = RoleEnum;

  /**
   * Show the result status-tracking / comment side panel by default. This is the
   * page reached by opening a folder, where an individual result can be
   * highlighted to view its timeline and comment on it — the level the Course
   * Coordinator's DRAFT folder list could not support. Other roles can still
   * collapse it to a full-width table via the toggle.
   */
  collapseView = signal<boolean>(false);

  resultTableRef =
    viewChild<ResultManagementFileTableComponent>('resultTableRef');

  ngOnInit(): void {
    this.getResultAndAnalytics();
  }

  toggleView() {
    this.collapseView.update((prev) => !prev);
  }

  getResultAndAnalytics() {
    this.loadingResult.set(true);

    const result$ = this.resultsService.getResults({
      course: this.courseId,
      status: this.status,
      hasBeenSent: true,
    });
    const analytics$ = this.resultsService.getCourseResultsAnalytics({
      courseId: this.courseId,
      session: this.session,
    });

    forkJoin([result$, analytics$])
      .pipe(finalize(() => this.loadingResult.set(false)))
      .subscribe({
        next: ([resultResp, analyticsResp]) => {
          if (resultResp.status) {
            const { page, limit, total, result } = resultResp.data;

            this.pagination.update((prev: IPaginator) => {
              prev.page = page;
              prev.pageSize = limit;
              prev.total = total;

              return prev;
            });
            this.results.set(result);
          }

          if (analyticsResp.status) {
            const {
              A,
              B,
              C,
              D,
              E,
              F,
              total,
              totalPass,
              totalFail,
              averageTotal,
              percentagePass,
              percentageFail,
            } = analyticsResp.data as {
              A: number;
              B: number;
              C: number;
              D: number;
              E: number;
              F: number;
              total: number;
              totalPass: number;
              totalFail: number;
              averageTotal: number;
              percentagePass: number;
              percentageFail: number;
            };

            const analyticsData = [
              A || 0,
              B || 0,
              C || 0,
              D || 0,
              E || 0,
              F || 0,
            ];

            this.analyticsChartData.set(analyticsData);
            this.totalStudent.set(total);
            this.totalStudentPass.set(totalPass || 0);
            this.totalStudentFail.set(totalFail || 0);
            this.averageTotal.set(averageTotal || 0);
            this.percentagePass.set(percentagePass || 0);
            this.percentageFail.set(percentageFail || 0);
          }
        },
      });
  }

  get resultIsSelected() {
    return (this.resultTableRef()?.selection?.selected?.length ?? 0) > 0;
  }

  get resultIsHighlighted() {
    return this.resultTableRef()?.activeRow() !== null;
  }

  editResult(result: IResult) {
    const { _id } = result;

    this.router.navigate(['/result-management/edit-results'], {
      queryParams: { resultId: _id, status: this.status },
    });
  }

  confirmSendToHOD() {
    const selectedResults = this.resultTableRef()?.selection.selected;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return;
    }

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to send this ${selectedResults.length} result(s) to the Head of Department. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirm: boolean) => {
          if (confirm) this.sendToHOD(selectedResults);
        },
      });
  }

  private sendToHOD(results: IResult[]) {
    this.sendingToHOD.set(true);

    const approveBulkReq = results.map((result) =>
      this.resultsService.approveResult(result._id)
    );

    // First HOD in the chain is always the course-owning department's HOD.
    const payload: ISendSelectedResult[] = results.map((result) => ({
      resultId: result._id,
      recipient: result.roles.HOD_COURSE_DEPT ?? '',
    }));

    forkJoin(approveBulkReq)
      .pipe(
        switchMap((resp) => {
          const isSuccessful = resp.every((res) => res.status);

          if (isSuccessful) {
            return this.resultsService.sendSelectedResult(
              payload,
              RoleEnum.HOD
            );
          }

          return throwError(() => {
            const error = new Error('Failed to approve result');
            return error;
          });
        }),
        finalize(() => this.sendingToHOD.set(false))
      )
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Result has been sent to the Head of Department(HOD)'
            );

            this.getResultAndAnalytics();
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

  confirmSendToLecturer() {
    const selectedResults = this.resultTableRef()?.selection.selected;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return;
    }

    this.dialog
      .open(RejectReasonComponent, {
        width: '600px',
        data: {
          resultId: selectedResults[0]._id,
        },
      })
      .afterClosed()
      .subscribe({
        next: (comment: string) => {
          if (comment) this.sendToLecturer(selectedResults, comment);
        },
      });
  }

  private sendToLecturer(results: IResult[], comment: string) {
    this.sendingToLecturer.set(true);

    const rejectBulkReq = results.map((result) =>
      this.resultsService.rejectResult(result._id, comment)
    );

    const payload: ISendSelectedResult[] = results.map((result) => ({
      resultId: result._id,
      recipient: (result.uploadedBy as { _id: string })._id,
    }));

    forkJoin(rejectBulkReq)
      .pipe(
        switchMap((resp) => {
          const isSuccessful = resp.every((res) => res.status);

          if (isSuccessful) {
            return this.resultsService.sendSelectedResult(
              payload,
              RoleEnum.LECTURER
            );
          }

          return throwError(() => {
            const error = new Error('Failed to rekject result');
            return error;
          });
        }),
        finalize(() => this.sendingToLecturer.set(false))
      )
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Result has been sent to the Lecturer'
            );

            this.getResultAndAnalytics();
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

  toggleTableView() {
    this.tableExpanded.set(!this.tableExpanded());
  }

  trackResult(result: IResult | null) {
    this.result.set(result);
  }

  sendComment(record: { resultId: string; comment: string }) {
    this.refreshComments.set(false);

    const { resultId, comment } = record;
    this.resultsService.sendResultComment(resultId, comment).subscribe({
      next: (resp) => {
        if (resp.status)
          this.toast.showNotification(
            'success',
            'Comment Submitted',
            'Comment has been submitted for this result'
          );

        this.refreshComments.set(true);
      },
    });
  }
}
