import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ICourse } from '../../../courses/models/course.model';
import { CommentComponent } from '../../components/comment/comment.component';
import { ResultManagementFileTableComponent } from '../../components/result-management-file-table/result-management-file-table.component';
import { ResultManagementFolderTableComponent } from '../../components/result-management-folder-table/result-management-folder-table.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';
import { IResult } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-result-management',
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

  results = signal<IResult[]>([]);
  currentRole = signal<RoleEnum>(this.authService.activeAccount()!.role);

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
    this.getResults();
  }

  getResults() {
    this.resultService
      .getResults({
        status: this.activeSegment().value,
      })
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.results.set(resp.data.result);
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

  sendToCC() {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to send this result to the Course Coordinator. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (file: File | null) => {
          if (file) {
            console.warn('Uploaded File: ', file);
          }
        },
      });
  }

  sendToHOD() {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to send this result to the Head of Department. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (file: File | null) => {
          if (file) {
            console.warn('Uploaded File: ', file);
          }
        },
      });
  }

  viewResult(course: ICourse) {
    this.router.navigate(['verify-result'], {
      relativeTo: this.route,
      queryParams: { resultId: course._id },
    });
  }
}
