import { Component, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { MyResultGridCardComponent } from '../../components/my-result-grid-card/my-result-grid-card.component';
import { MyResultListCardComponent } from '../../components/my-result-list-card/my-result-list-card.component';
import { Router } from '@angular/router';

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
  ],
  templateUrl: './my-results.component.html',
  styleUrl: './my-results.component.scss',
})
export class MyResultsComponent {
  private readonly router = inject(Router);
  view = signal<'list' | 'grid'>('list');
  viewLabel = signal<string>('Grid View');
  viewIcon = signal<string>('icons/general/grid-icon.svg');

  activeSegment = signal<ISegmentSwitcher>({
    label: 'Drafts',
    value: 'drafts',
    roleAccess: RoleEnum.ALL,
  });
  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Drafts',
      value: 'drafts',
      roleAccess: RoleEnum.ALL,
    },
    {
      label: 'Pending',
      value: 'pending',
      roleAccess: RoleEnum.ALL,
    },
    {
      label: 'Unverified',
      value: 'unverified',
      roleAccess: RoleEnum.ALL,
    },
    {
      label: 'Verified',
      value: 'verified',
      roleAccess: RoleEnum.ALL,
    },
    {
      label: 'Published',
      value: 'published',
      roleAccess: RoleEnum.ALL,
    },
  ]);

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

    switch (switchValue) {
      case 'drafts': {
        break;
      }
      case 'pending': {
        break;
      }
      case 'unverified': {
        break;
      }
      case 'verified': {
        break;
      }
      case 'published': {
        break;
      }
    }
  }

  uploadResults() {
    this.router.navigate(['courses/result-upload']);
  }
}
