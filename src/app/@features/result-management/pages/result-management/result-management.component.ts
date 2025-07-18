import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe, NgClass } from '@angular/common';
import { Component, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { COURSES } from '../../../../@core/constant/course-mock';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { ICourse } from '../../../courses/models/course.model';
import { CommentComponent } from '../../components/comment/comment.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';

@Component({
  selector: 'app-result-management',
  imports: [
    NgClass,
    SvgComponent,
    MatTableModule,
    SegmentSwitcherComponent,
    DatePipe,
    MatSelectModule,
    MatFormFieldModule,
    CardComponent,
    MatMenuModule,
    ButtonComponent,
    ResultStatusTrackingComponent,
    MatCheckboxModule,
    PaginatorComponent,
    CommentComponent,
  ],
  templateUrl: './result-management.component.html',
  styleUrl: './result-management.component.scss',
})
export class ResultManagementComponent {
  displayedColumns: string[] = [
    'select',
    'courseCode',
    'courseTitle',
    'session',
    'department',
    'faculty',
  ];
  dataSource = signal<ICourse[]>(COURSES);
  selection = new SelectionModel<ICourse>(true, []);

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
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');

  expandView = signal<boolean>(false);

  toggleView() {
    this.expandView.update((prev) => !prev);

    if (this.expandView()) {
      this.displayedColumns.push('uploadedDate', 'sentDate', 'actions');
    } else {
      this.displayedColumns = this.displayedColumns.filter(
        (col) => !['uploadedDate', 'sentDate', 'actions'].includes(col)
      );
    }
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource().length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource());
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: ICourse): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.courseCode + 1}`;
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
        this.segmentCardLabel.set('Access your recent drafts from here');
        this.segmentCardIconSrc.set('icons/general/draft-icon.svg');
        break;
      }
      case 'pending': {
        this.segmentCardLabel.set('Access your pending results from here');
        this.segmentCardIconSrc.set('icons/general/pending-icon.svg');
        break;
      }
      case 'unverified': {
        this.segmentCardLabel.set('Access your unverified results from here');
        this.segmentCardIconSrc.set('icons/general/unverified-icon.svg');
        break;
      }
      case 'verified': {
        this.segmentCardLabel.set('Access your verified results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'published': {
        this.segmentCardLabel.set('Access your published results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
    }
  }
}
