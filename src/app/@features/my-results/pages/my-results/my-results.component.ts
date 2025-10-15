import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { IResult } from '../../../result-management/models/results.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { DeleteConfirmationDialogComponent } from '../../components/app-delete-confirmation-dialog/app-delete-confirmation-dialog.component';
import { MyResultGridCardComponent } from '../../components/my-result-grid-card/my-result-grid-card.component';
import { MyResultListCardComponent } from '../../components/my-result-list-card/my-result-list-card.component';

@Component({
  selector: 'app-my-results',
  imports: [
    SvgComponent,
    ButtonComponent,
    SearchInputComponent,
    MatFormFieldModule,
    MatSelectModule,
    MyResultGridCardComponent,
    MyResultListCardComponent,
    SegmentSwitcherComponent,
    LoaderComponent,
    EmptyStateComponent,
    RouterLink,
    DatePipe,
  ],
  templateUrl: './my-results.component.html',
  styleUrl: './my-results.component.scss',
})
export class MyResultsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly resultService = inject(ResultsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  isloadingResults = signal(false);
  results = signal<any[]>([]);
  drafts = signal<any[]>([]);

  view = signal<'list' | 'grid'>('list');
  viewLabel = signal<string>('Grid View');
  viewIcon = signal<string>('icons/general/grid-icon.svg');

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Drafts',
      value: 'DRAFT',
      accessRole: [RoleEnum.LECTURER, RoleEnum.COURSE_COORDINATOR],
    },
  ]);
  activeSegment = signal<ISegmentSwitcher>({
    label: 'Drafts',
    value: 'DRAFT',
    accessRole: [RoleEnum.LECTURER, RoleEnum.COURSE_COORDINATOR],
  });

  ngOnInit(): void {
    this.getResults();
    // Refresh drafts when component loads
    if (this.activeSegment().value === 'DRAFT') {
      this.loadDrafts();
    }

    // Listen for when user returns to this page to refresh drafts
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.activeSegment().value === 'DRAFT') {
        console.log('Page became visible, refreshing drafts');
        this.loadDrafts();
      }
    });
  }

  getResults() {
    if (this.activeSegment().value === 'DRAFT') {
      this.loadDrafts();
      return;
    }

    this.isloadingResults.set(true);
    this.resultService
      .getResults({
        status: this.activeSegment().value,
      })
      .pipe(finalize(() => this.isloadingResults.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.results.set(resp.data.result);
          }
        },
      });
  }

  loadDrafts() {
    this.isloadingResults.set(true);

    try {
      const draftsListData = localStorage.getItem('result_drafts_list');
      console.log('Loading drafts from localStorage:', draftsListData);

      if (!draftsListData) {
        this.drafts.set([]);
        this.isloadingResults.set(false);
        return;
      }

      const draftsList = JSON.parse(draftsListData);
      const draftsWithDetails = draftsList
        .map((draft: any) => {
          // Get the actual draft data from first available segment
          let draftData = null;

          for (const segment of draft.segments) {
            const draftKey = `result_draft_${draft.resultId}_${segment}`;
            const segmentDraftData = localStorage.getItem(draftKey);
            if (segmentDraftData) {
              draftData = JSON.parse(segmentDraftData);
              break;
            }
          }

          if (draftData) {
            return {
              _id: draft.resultId,
              title:
                draft.courseDetails?.courseTitle ||
                draftData.courseDetails?.courseTitle ||
                `Draft - ${draft.resultId}`,
              status: 'DRAFT',
              timestamp: draft.timestamp,
              segments: draft.segments,
              studentCount:
                draft.totalStudents ||
                draftData.totalStudents ||
                draftData.students?.length ||
                0,
              studentsWithGrades:
                draft.studentsWithGrades || draftData.studentsWithGrades || 0,
              completionPercentage:
                draft.completionPercentage ||
                draftData.completionPercentage ||
                0,
              courseDetails: draft.courseDetails ||
                draftData.courseDetails || {
                  courseTitle: 'Unknown Course',
                  session: 'Unknown Session',
                  level: 'Unknown Level',
                  units: 3,
                },
              isDraft: true,
            };
          }
          return null;
        })
        .filter(Boolean);

      console.log('Processed drafts:', draftsWithDetails);
      this.drafts.set(draftsWithDetails);
    } catch (error) {
      console.error('Error loading drafts:', error);
      this.drafts.set([]);
    }

    this.isloadingResults.set(false);
  }

  toggleView() {
    this.view.set(this.view() === 'list' ? 'grid' : 'list');

    if (this.view() === 'list') {
      this.viewLabel.set('Grid View');
      this.viewIcon.set('icons/general/grid-icon.svg');
    } else {
      this.viewLabel.set('List View');
      this.viewIcon.set('icons/general/list-icon.svg');
    }
  }

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    this.getResults();

    // Refresh drafts when switching to DRAFT segment
    if (switchValue === 'DRAFT') {
      setTimeout(() => this.loadDrafts(), 100);
    }
  }

  deleteDraft(resultId: string) {
    const draft = this.drafts().find((d) => d._id === resultId);
    if (!draft) return;

    const dialogData = {
      title: 'Delete Draft Result',
      message: `Are you sure you want to delete the draft for "${draft.courseDetails?.courseTitle || 'Unknown Course'}"? This action cannot be undone and will permanently remove all saved progress.`,
      confirmText: 'Delete Draft',
      cancelText: 'Cancel',
      isDangerous: true,
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '500px',
      disableClose: true,
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      // Remove all draft data for this result
      const segments = ['REGULAR', 'REFERENCE', 'UNREGISTERED'];
      segments.forEach((segment) => {
        localStorage.removeItem(`result_draft_${resultId}_${segment}`);
      });

      // Update drafts list
      const draftsListData = localStorage.getItem('result_drafts_list');
      if (draftsListData) {
        const draftsList = JSON.parse(draftsListData);
        const updatedList = draftsList.filter(
          (d: any) => d.resultId !== resultId
        );
        localStorage.setItem('result_drafts_list', JSON.stringify(updatedList));
      }

      // Show success message
      this.toast.showNotification(
        'success',
        'Draft Deleted',
        'Draft result has been deleted successfully'
      );

      // Refresh drafts display
      this.loadDrafts();
    });
  }

  viewResult(result: IResult) {
    this.router.navigate(['upload-result'], {
      queryParams: { resultId: result._id },
      relativeTo: this.route,
    });
  }
}
