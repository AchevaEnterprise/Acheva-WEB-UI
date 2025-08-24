import { Component, inject, OnInit, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
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
  ],
  templateUrl: './my-results.component.html',
  styleUrl: './my-results.component.scss',
})
export class MyResultsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly resultService = inject(ResultsService);

  isloadingResults = signal(false);
  results = signal<any[]>([]);

  view = signal<'list' | 'grid'>('list');
  viewLabel = signal<string>('Grid View');
  viewIcon = signal<string>('icons/general/grid-icon.svg');

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
  activeSegment = signal<ISegmentSwitcher>(this.segments()[0]);

  ngOnInit(): void {
    this.getResults();
  }

  getResults() {
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
  }

  viewResult(result: IResult) {
    this.router.navigate(['upload-result'], {
      queryParams: { resultId: result._id },
      relativeTo: this.route,
    });
  }
}
