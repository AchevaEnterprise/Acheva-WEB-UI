import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { RoleEnum } from '../../../../auth/model/auth.model';

import { TitleCasePipe } from '@angular/common';
import { ToastService } from '../../../../../@core/utility/toast.service';
import { AssignCourseAdvisorComponent } from '../../../../../@shared/components/assign-course-advisor/assign-course-advisor.component';
import { BackButtonComponent } from '../../../../../@shared/components/back-button/back-button.component';
import { EmptyStateComponent } from '../../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../../@shared/components/forms/search-input/search-input.component';
import { SkeletonTableComponent } from '../../../../../@shared/components/skeleton/skeleton-table.component';
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
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    ButtonComponent,
    MatSlideToggleModule,
    StatusBadgeComponent,
    PaginatorComponent,
    SearchInputComponent,
    SvgComponent,
    SkeletonTableComponent,
    EmptyStateComponent,
    BackButtonComponent,
    FormsModule,
    TitleCasePipe,
  ],
  templateUrl: './lecturer-management.component.html',
  styleUrl: './lecturer-management.component.scss',
})
export class LecturerManagementComponent implements OnInit {
  private readonly lecturerService = inject(LecturersService);
  private readonly authService = inject(AuthenticationService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  userDepartmentId = this.authService.activeAccount()?.department!._id;

  currentPage = signal(0);

  displayedColumns: string[] = [
    'name',
    'email',
    'level',
    'admissionYear',
    'action',
    'status',
    'toggle',
  ];

  // Data and loading states
  lecturersData = signal<ILecturer[]>([]);
  loading = signal<boolean>(false);
  searchQuery = signal<string>('');
  filterValue = signal<string>('');

  pageSize = signal(10);

  /**
   * Filter by the OFFICE a lecturer holds, which is what a Head actually
   * wants to narrow by. The dropdown previously offered a single option,
   * "Science", which is not a property a lecturer has.
   */
  readonly roleOptions = [
    { label: 'All roles', value: '' },
    { label: 'Course Advisor', value: RoleEnum.COURSE_ADVISOR },
    { label: 'Course Coordinator', value: RoleEnum.COURSE_COORDINATOR },
    { label: 'Lecturer', value: RoleEnum.LECTURER },
    { label: 'HOD', value: RoleEnum.HOD },
  ];

  /** Search over name and email, then narrow by role. */
  readonly filteredLecturers = computed(() => {
    const term = this.searchQuery().trim().toLowerCase();
    const role = this.filterValue();

    return this.lecturersData().filter((lecturer) => {
      if (role && lecturer.role !== role) return false;
      if (!term) return true;
      const name =
        `${lecturer.firstname ?? ''} ${lecturer.lastname ?? ''}`.toLowerCase();
      return (
        name.includes(term) ||
        (lecturer.email ?? '').toLowerCase().includes(term)
      );
    });
  });

  /** The slice on screen. */
  readonly pagedLecturers = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredLecturers().slice(start, start + this.pageSize());
  });

  readonly paginator = computed(() => ({
    page: this.currentPage() + 1,
    pageSize: this.pageSize(),
    total: this.filteredLecturers().length,
  }));

  // Available levels for assignment
  levelOptions = [
    { label: '100 Level', value: '100' },
    { label: '200 Level', value: '200' },
    { label: '300 Level', value: '300' },
    { label: '400 Level', value: '400' },
  ];

  ngOnInit(): void {
    this.getLecturers();
  }

  getLecturers(): void {
    this.loading.set(true);
    this.lecturerService
      .getLecturersInDepartment(this.userDepartmentId!)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.lecturersData.set(resp.data);
          }
        },
      });
  }

  /**
   * Search, filter and pagination — all three were written and NONE was
   * connected.
   *
   * `onSearch` and `onFilter` existed but nothing called them: the search
   * box carried no `(searchEvent)`, the dropdown no `(selectionChange)`, and
   * `<app-paginator />` was rendered with no inputs and no output, so it
   * could neither show a range nor turn a page. Three controls that looked
   * like a working toolbar and did nothing at all.
   *
   * The whole department is fetched in one call, so all three run in memory.
   */
  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(0); // a narrower list has fewer pages
  }

  onFilter(value: string): void {
    this.filterValue.set(value);
    this.currentPage.set(0);
  }

  onPage(event: { pageIndex: number; pageSize: number }): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  confirmAssignAsCourseAdvisor(lecturer: ILecturer): void {
    this.dialog
      .open(AssignCourseAdvisorComponent, {
        width: '40%',
        data: {
          lecturer: `${lecturer.firstname} ${lecturer.lastname}`,
          lecturerId: lecturer._id,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getLecturers();
        },
      });
  }

  confirmUnassignAsCourseAdvisor(lecturer: ILecturer): void {
    this.dialog
      .open(UnassignCourseAdvisorComponent, {
        width: '40%',
        data: {
          lecturerId: lecturer._id,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getLecturers();
        },
      });
  }

  toggleLecturerActiveState(lecturer: ILecturer): void {
    const isActive = lecturer.isActive;

    this.lecturerService
      .activateOrDeactivateLecturer(lecturer._id, !isActive)
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              `Lecturer ${isActive ? 'Deactivated' : 'Activated'}`,
              `Lecturer account ${isActive ? 'deactivated' : 'activated'} successfully`
            );
            this.getLecturers();
          }
        },
      });
  }
}
