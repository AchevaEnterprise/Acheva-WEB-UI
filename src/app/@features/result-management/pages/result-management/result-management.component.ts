import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { CommentComponent } from '../../components/comment/comment.component';
import { ResultManagementFileTableComponent } from '../../components/result-management-file-table/result-management-file-table.component';
import { ResultManagementFolderTableComponent } from '../../components/result-management-folder-table/result-management-folder-table.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';
import { IResult } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-result-management',
  standalone: true,
  imports: [
    NgClass,
    SegmentSwitcherComponent,
    ButtonComponent,
    ResultStatusTrackingComponent,
    CommentComponent,
    MatTooltipModule,
    CardComponent,
    ResultManagementFolderTableComponent,
    ResultManagementFileTableComponent,
    RoleAccessDirective,
    MatMenuModule,
  ],
  templateUrl: './result-management.component.html',
  styleUrl: './result-management.component.scss',
})
export class ResultManagementComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly resultService = inject(ResultsService);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);

  currentRole = signal<RoleEnum>(this.authService.activeAccount()!.role);

  fileTableRef = viewChild<ResultManagementFileTableComponent>('fileTableRef');
  folderTableRef =
    viewChild<ResultManagementFolderTableComponent>('folderTableRef');

  results = signal<IResult[]>([]);
  preparedResults = signal<IResult[]>([]);

  pagination = signal<IPaginator>({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  sendingToCC = signal<boolean>(false);
  sendingToHOD = signal<boolean>(false);
  sendingToCA = signal<boolean>(false);
  publishing = signal<boolean>(false);
  importing = signal<boolean>(false);

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
  activeSegment = signal<ISegmentSwitcher>(
    this.currentRole() === RoleEnum.HOD
      ? this.segments()[1]
      : this.segments()[0]
  );
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');

  expandView = signal<boolean>(false);

  RoleEnum = RoleEnum;

  ngOnInit(): void {
    if (this.currentRole() === RoleEnum.COURSE_COORDINATOR)
      this.getPreparedResults();
    else this.getResults();
  }

  getResults() {
    this.resultService
      .getResults({
        status: this.activeSegment().value,
      })
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

  getPreparedResults() {
    this.resultService
      .getPreparedResults({
        status: this.activeSegment().value,
      })
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const response = resp.data as {
              count: number;
              filters: object;
              message: string;
              results: Array<IResult>;
            };

            this.preparedResults.set(response.results);
          }
        },
      });
  }

  toggleView() {
    this.expandView.update((prev) => !prev);
  }

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
      case 'PUBLISHED': {
        this.segmentCardLabel.set('Access your published results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
    }

    this.getResults();
  }

  confirmSendToCC() {
    let selectedResults: IResult[] = [];

    const fileTable = this.fileTableRef();
    if (fileTable) selectedResults = fileTable.selection.selected;

    if (selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'Missing Selections',
        'No result has been checked/selected to submit'
      );
      return;
    }

    const message = `You're about to send ${selectedResults.length} results to the Course Coordinator. This action is irreversible, Are you sure you want to continue?`;

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: message,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToCC(selectedResults);
        },
      });
  }

  private sendToCC(selectedResults: IResult[]) {
    this.sendingToCC.set(true);

    const resultRequest$ = selectedResults?.map((result) =>
      this.resultService.sendResult(result._id, result.receivingHandler)
    );

    forkJoin(resultRequest$)
      .pipe(finalize(() => this.sendingToCC.set(false)))
      .subscribe({
        next: (resp) => {
          this.toast.showNotification(
            'success',
            'Result Sent',
            'Result has been sent to the Course Cordinator'
          );
        },
      });
  }

  confirmSendToHOD() {
    let selectedResults: IResult[] = [];

    const folderTable = this.folderTableRef();
    if (folderTable) selectedResults = folderTable.selection.selected;

    if (selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'Missing Selections',
        'No result has been checked/selected to submit'
      );
      return;
    }

    const message = `You're about to send ${selectedResults.length} results to the Head of Department. This action is irreversible, Are you sure you want to continue?`;

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: message,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToHOD(selectedResults);
        },
      });
  }

  sendToHOD(selectedResults: IResult[]) {
    this.sendingToHOD.set(true);

    const resultRequest$ = selectedResults?.map((result) =>
      this.resultService.sendResult(result._id, result.receivingHandler)
    );

    forkJoin(resultRequest$)
      .pipe(finalize(() => this.sendingToHOD.set(false)))
      .subscribe({
        next: (resp) => {
          this.toast.showNotification(
            'success',
            'Result Sent',
            'Result has been sent to the Head of Department'
          );
        },
      });
  }

  confirmSendToCA() {}

  publishResult() {}

  importResult() {}

  resendToCC() {}

  resendToDean() {}

  viewResult(result: IResult) {
    const { _id, status } = result;

    if (this.currentRole() === RoleEnum.LECTURER) {
      this.router.navigate(['/my-result/upload-result'], {
        queryParams: { resultId: _id },
      });
      return;
    }

    this.router.navigate(['edit-results'], {
      relativeTo: this.route,
      queryParams: { resultId: _id, status },
    });
  }

  viewFolder(result: IResult) {
    const { _id, status } = result;

    this.router.navigate(['view-results'], {
      relativeTo: this.route,
      queryParams: { resultId: _id, status },
    });
  }
}
