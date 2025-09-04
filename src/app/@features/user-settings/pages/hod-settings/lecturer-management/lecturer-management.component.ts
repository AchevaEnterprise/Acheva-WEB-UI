import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { AssignCourseAdvisorComponent } from '../../../../../@shared/components/assign-course-advisor/assign-course-advisor.component';
import { EmptyStateComponent } from '../../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../../@shared/components/paginator/paginator.component';
import { StatusBadgeComponent } from '../../../../../@shared/components/status-badge/status-badge.component';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';
import { UnassignCourseAdvisorComponent } from '../../../../../@shared/components/unassign-course-advisor/unassign-course-advisor.component';
import { AuthenticationService } from '../../../../auth/service/auth.service';
import { ILecturer } from '../../../models/lecturer.model';
import { LecturersService } from '../../../service/lecturer.service';

@Component({
  selector: 'app-lecturer-management',
  imports: [
    MatTableModule,
    DatePipe,
    ButtonComponent,
    MatSlideToggleModule,
    StatusBadgeComponent,
    PaginatorComponent,
    SearchInputComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    SvgComponent,
    LoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './lecturer-management.component.html',
  styleUrl: './lecturer-management.component.scss',
})
export class LecturerManagementComponent implements OnInit {
  private readonly lecturerService = inject(LecturersService);
  private readonly authService = inject(AuthenticationService);
  private readonly dialog = inject(MatDialog);

  userDepartmentId = this.authService.activeAccount()?.department;

  displayedColumns: string[] = [
    'name',
    'email',
    'level',
    'lastDateModified',
    'action',
    'assign',
    'status',
  ];
  dataSource = signal<ILecturer[]>([]);
  loading = signal<boolean>(false);

  ngOnInit(): void {
    this.getLecturers();
  }

  getLecturers() {
    this.loading.set(true);
    this.lecturerService
      .getLecturersInDepartment(this.userDepartmentId!)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.dataSource.set(resp.data.data);
          }
        },
      });
  }

  confirmAssignAsCourseAdvisor(row: ILecturer) {
    this.dialog
      .open(AssignCourseAdvisorComponent, {
        width: '40%',
        data: {
          lecturer: `${row.firstname} ${row.lastname}`,
          lecturerId: row._id,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getLecturers();
        },
      });
  }

  confirmUnassignAsCourseAdvisor(row: ILecturer) {
    this.dialog
      .open(UnassignCourseAdvisorComponent, {
        width: '40%',
        data: {
          lecturerId: row._id,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getLecturers();
        },
      });
  }
}
