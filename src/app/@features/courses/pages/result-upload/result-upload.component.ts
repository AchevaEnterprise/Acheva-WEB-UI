import { SelectionModel } from '@angular/cdk/collections';
import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { STUDENT_GRADES } from '../../../../@core/constant/student-grade-mock';
import { UtilityService } from '../../../../@core/utility/utility.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AnalyticsChartComponent } from '../../components/analytics-chart/analytics-chart.component';
import { IStudentGrade } from '../../models/student-grade.model';

@Component({
  selector: 'app-result-upload',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    CardComponent,
    SegmentSwitcherComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    AnalyticsChartComponent,
    MatDividerModule,
    ButtonComponent,
    MatRadioModule,
    SearchInputComponent,
    PaginatorComponent,
    MatCheckboxModule,
  ],
  templateUrl: './result-upload.component.html',
  styleUrl: './result-upload.component.scss',
})
export class ResultUploadComponent {
  private readonly utilityService = inject(UtilityService);
  folderDisplayedColumns: string[] = [
    'select',
    'regNo',
    'name',
    'assessment1',
    'assessment2',
    'project1',
    'project2',
    'attendance',
    'exam',
    'finalGrade',
  ];
  dataSource = signal<Partial<IStudentGrade>[]>(STUDENT_GRADES);
  selection = new SelectionModel<Partial<IStudentGrade>>(true, []);

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Regular',
      value: 'regular',
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
      value: 'reference',
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

  courseForm = new FormGroup({
    course: new FormControl(''),
    session: new FormControl(''),
    level: new FormControl(''),
    category: new FormControl(''),
  });

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
      case 'regular': {
        break;
      }
      case 'reference': {
        break;
      }
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
  checkboxLabel(row?: IStudentGrade): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.name + 1}`;
  }

  saveChanges() {
    this.utilityService.exportToExcel(this.dataSource(), 'Student-Result');
  }
}
