import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AnalyticsChartComponent } from '../../../my-results/components/analytics-chart/analytics-chart.component';
import { ResultManagementFileTableComponent } from '../../components/result-management-file-table/result-management-file-table.component';
import { IResult, ISendSelectedResult } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-view-results',
  imports: [
    ResultManagementFileTableComponent,
    SearchInputComponent,
    AnalyticsChartComponent,
    MatDividerModule,
    MatTooltipModule,
    CardComponent,
    RoleAccessDirective,
    ButtonComponent,
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

  readonly courseId: string =
    this.route.snapshot.queryParamMap.get('courseId')!;
  readonly status: string = this.route.snapshot.queryParamMap.get('status')!;

  results = signal<IResult[]>([]);
  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);

  pagination = signal<IPaginator>({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  loadingResult = signal<boolean>(false);
  sendingToHOD = signal<boolean>(false);
  RoleEnum = RoleEnum;

  resultTableRef =
    viewChild<ResultManagementFileTableComponent>('resultTableRef');

  ngOnInit(): void {
    this.getResultAndAnalytics();
  }

  getResultAndAnalytics() {
    this.loadingResult.set(true);

    const result$ = this.resultsService.getResults({
      course: this.courseId,
      status: this.status,
      hasBeenSent: true,
    });
    // const analytics$ = this.resultsService.getResultAnalytics(this.resultId);

    forkJoin([result$])
      .pipe(finalize(() => this.loadingResult.set(false)))
      .subscribe({
        next: ([resultResp]) => {
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

          // if (analyticsResp.status) {
          //   const {
          //     analytics,
          //     totalPass,
          //     totalFail,
          //     entries,
          //     studentsWithoutEntries,
          //   } = analyticsResp.data as {
          //     analytics: Record<string, number>;
          //     total: number;
          //     totalPass: number;
          //     totalFail: number;
          //     entries: Partial<IStudentGrade>[];
          //     studentsWithoutEntries?: Partial<IStudentGrade>[];
          //   };

          //   const analyticsData = [
          //     analytics['A'] || 0,
          //     analytics['B'] || 0,
          //     analytics['C'] || 0,
          //     analytics['D'] || 0,
          //     analytics['E'] || 0,
          //     analytics['F'] || 0,
          //   ];

          //   const studentResultEntries = [
          //     ...entries,
          //     ...(studentsWithoutEntries ?? []),
          //   ];

          //   this.analyticsChartData.set(analyticsData);
          //   this.totalStudent.set(studentResultEntries.length);
          //   this.totalStudentPass.set(totalPass || 0);
          //   this.totalStudentFail.set(totalFail || 0);
          // }
        },
      });
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

    const payload: ISendSelectedResult[] = results.map((result) => ({
      resultId: result._id,
      recipient: result.roles.HOD,
    }));

    this.resultsService
      .sendSelectedResult(payload, RoleEnum.HOD)
      .pipe(finalize(() => this.sendingToHOD.set(false)))
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
      });
  }
}
