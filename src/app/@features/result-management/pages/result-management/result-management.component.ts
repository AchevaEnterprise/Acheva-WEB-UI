import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { CommentComponent } from '../../../../@shared/components/forms/comment/comment.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ICourse } from '../../../courses/models/course.model';
import { CoursesService } from '../../../courses/services/courses.service';
import { ResendToCourseCoordinatorComponent } from '../../components/resend-to-course-coordinator/resend-to-course-coordinator.component';
import { ResendToDeanComponent } from '../../components/resend-to-dean/resend-to-dean.component';
import { ResultManagementFileTableComponent } from '../../components/result-management-file-table/result-management-file-table.component';
import { ResultManagementFolderTableComponent } from '../../components/result-management-folder-table/result-management-folder-table.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';
import { IResult, ISendSelectedResult } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

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
  private readonly courseService = inject(CoursesService);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);

  currentRole = signal<RoleEnum>(this.authService.activeAccount()?.role!);

  fileTableRef = viewChild<ResultManagementFileTableComponent>('fileTableRef');
  folderTableRef =
    viewChild<ResultManagementFolderTableComponent>('folderTableRef');

  result = signal<IResult | null>(null);
  results = signal<IResult[]>([]);
  courses = signal<ICourse[]>([]);

  pagination = signal<IPaginator>({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  loadingResults = signal<boolean>(false);
  sendingToCC = signal<boolean>(false);
  sendingToHOD = signal<boolean>(false);
  sendingToCA = signal<boolean>(false);
  resending = signal<boolean>(false);
  publishing = signal<boolean>(false);

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
      : this.currentRole() === RoleEnum.DEAN
        ? this.segments()[2]
        : this.currentRole() === RoleEnum.COURSE_ADVISOR
          ? this.segments()[3]
          : this.segments()[0]
  );
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');

  expandView = signal<boolean>(false);

  RoleEnum = RoleEnum;

  ngOnInit(): void {
    if (this.currentRole() === RoleEnum.COURSE_COORDINATOR) this.getCourses();
    else this.getResults();
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

  getCourses() {
    this.loadingResults.set(true);

    this.courseService
      .getCourses()
      .pipe(finalize(() => this.loadingResults.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.courses.set(resp.data['courses']);
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

  confirmSendResult(role: RoleEnum[]) {
    // const
  }

  confirmSendToCC() {
    const selectedResults: IResult[] = this.fileTableRef()?.selection.selected!;

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
          message: `You're about to send ${selectedResults.length} results to the Course Coordinator. This action is irreversible, Are you sure you want to continue?`,
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

    const payload: ISendSelectedResult[] = selectedResults.map((result) => ({
      resultId: result._id,
      recipient: result.roles.COURSE_COORDINATOR,
    }));

    this.resultService
      .sendSelectedResult(payload, RoleEnum.COURSE_COORDINATOR)
      .pipe(finalize(() => this.sendingToCC.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Result has been sent to the Course Cordinator'
            );
            this.getResults();
          }
        },
      });
  }

  confirmSendToHOD() {
    const selectedFolders = this.folderTableRef()?.selection.selected;

    if (!selectedFolders || selectedFolders.length < 1) {
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
          message: `You're about to send ${selectedFolders.length} results to their various Head of Departments. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToHOD(selectedFolders);
        },
      });
  }

  sendToHOD(selectedFolders: ICourse[]) {
    this.sendingToHOD.set(true);

    const courseIds: Array<string> = selectedFolders.map(
      (folder: ICourse) => folder._id!
    );

    this.resultService
      .sendBulkResult(RoleEnum.HOD, courseIds)
      .pipe(finalize(() => this.sendingToHOD.set(false)))
      .subscribe({
        next: (resp) => {
          this.toast.showNotification(
            'success',
            'Result Sent',
            'Result has been sent to the Course Advisor'
          );
        },
      });
  }

  confirmSendToCA() {
    const selectedResults = this.fileTableRef()?.selection.selected;

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
          message: `You're about to send ${selectedResults.length} results to the Course Advisor. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToCA(selectedResults);
        },
      });
  }

  sendToCA(selectedResults: IResult[]) {
    this.sendingToCA.set(true);

    const payload: ISendSelectedResult[] = selectedResults.map((result) => ({
      resultId: result._id,
      recipient: result.roles.COURSE_ADVISOR,
    }));

    this.resultService
      .sendSelectedResult(payload, RoleEnum.COURSE_ADVISOR)
      .pipe(finalize(() => this.sendingToCA.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Sent',
              'Result has been sent to the Course Advisor'
            );

            this.getResults();
          }
        },
      });
  }

  confirmPublishResult() {
    const selectedResults = this.fileTableRef()?.selection.selected;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be published'
      );
      return;
    }

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to publish ${selectedResults.length} results. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.publishResult(selectedResults);
        },
      });
  }

  publishResult(selectedResults: IResult[]) {
    this.publishing.set(true);

    const publishResultRequests$ = selectedResults?.map((result: IResult) =>
      this.resultService.publishResult(result._id)
    );

    forkJoin(publishResultRequests$)
      .pipe(finalize(() => this.publishing.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp) {
            this.toast.showNotification(
              'success',
              'Result Published',
              'Result has been published successfully'
            );

            this.getResults();
          }
        },
      });
  }

  importResult() {
    this.router.navigate(['/courses/details'], {
      queryParams: {
        new: true,
      },
    });
  }

  confirmResendToCC() {
    const selectedResults: IResult[] = this.fileTableRef()?.selection.selected!;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return;
    }

    this.dialog
      .open(ResendToCourseCoordinatorComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.sendToCC(selectedResults);
        },
      });
  }

  confirmResendToDean() {
    const selectedResults: IResult[] = this.fileTableRef()?.selection.selected!;

    if (!selectedResults || selectedResults.length < 1) {
      this.toast.showNotification(
        'error',
        'No Result(s) Selected',
        'You have not selected any result(s) to be sent'
      );
      return;
    }

    this.dialog
      .open(ResendToDeanComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) this.resendToDean(selectedResults);
        },
      });
  }

  resendToDean(selectedResults: IResult[]) {
    this.resending.set(true);

    const payload: ISendSelectedResult[] = selectedResults.map((result) => ({
      resultId: result._id,
      recipient: result.roles.DEAN,
    }));

    this.resultService
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

            this.getResults();
          }
        },
      });
  }

  viewResult(result: IResult) {
    const { _id, status } = result;

    this.router.navigate(['edit-results'], {
      relativeTo: this.route,
      queryParams: { resultId: _id, status },
    });
  }

  trackResult(result: IResult) {
    this.result.set(result);
  }

  viewFolder(course: ICourse) {
    const { _id } = course;

    this.router.navigate(['view-results'], {
      relativeTo: this.route,
      queryParams: { courseId: _id, status: this.activeSegment().value },
    });
  }

  sendComment(comment: string) {}
}
