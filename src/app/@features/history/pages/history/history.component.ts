import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { COURSES } from '../../../../@core/constant/course-mock';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse } from '../../../courses/models/course.model';
import { HistoryPreviewComponent } from '../../components/history-preview/history-preview.component';
import { MatInputModule } from '@angular/material/input';
@Component({
  selector: 'app-history',
  imports: [
    SearchInputComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    SvgComponent,
    MatDatepickerModule,
    ButtonComponent,
    MatTableModule,
    StatusBadgeComponent,
    MatDialogModule,
    ReactiveFormsModule,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  private readonly dialog = inject(MatDialog);

  displayedColumns: string[] = ['courseCode', 'courseTitle', 'status'];
  dataSource = signal<ICourse[]>(COURSES);

  dateFilters = new FormGroup({
    startDate: new FormControl(''),
    endDate: new FormControl(''),
  });

  today = new Date();

  applyDateFilters() {}

  previewHistory(row: any) {
    this.dialog.open(HistoryPreviewComponent, {
      width: '600px',
      height: '90%',
      position: { top: '50px', right: '20px' },
    });
  }
}
