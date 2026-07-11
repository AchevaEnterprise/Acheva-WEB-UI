import { TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { IAPIResponse } from '../../../../@core/models/api-response.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { UploadDialogComponent } from '../../../../@shared/components/upload-dialog/upload-dialog.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { LecturersService } from '../../../user-settings/service/lecturer.service';
import { AddStudentDialogComponent } from '../../components/add-student-dialog/add-student-dialog.component';
import { IStudent, IStudentAcademicFlags } from '../../models/student.model';
import { StudentService } from '../../services/student.service';

@Component({
  selector: 'app-students',
  imports: [
    SearchInputComponent,
    ButtonComponent,
    MatTableModule,
    MatTooltipModule,
    SkeletonTableComponent,
    EmptyStateComponent,
    TitleCasePipe,
  ],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly studentService = inject(StudentService);
  private readonly lecturerService = inject(LecturersService);
  private readonly dialog = inject(MatDialog);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  displayedColumns: string[] = [
    'sn',
    'issues',
    'registrationNumber',
    'fullName',
    'actions',
  ];
  /** Table rows — the current view (filtered when a search term is active). */
  dataSource = signal<IStudent[]>([]);
  /** Immutable master list; the search always filters from here. */
  students = signal<IStudent[]>([]);
  /** Students with at least one failed course on a published result. */
  studentsWithIssues = signal<ReadonlySet<string>>(new Set());
  /** The active, trimmed search term (drives the "no matches" empty state). */
  searchTerm = signal('');
  /** Empty-state copy shown when a search returns no rows. */
  readonly noMatchesMessage = computed(
    () => `No students match "${this.searchTerm()}"`
  );

  loading = signal(false);
  uploading = signal(false);

  ngOnInit(): void {
    this.getStudents();
  }

  /**
   * Filters the list by student name OR registration number. The debounce
   * lives in `SearchInputComponent`, which emits the term via `searchEvent`.
   */
  onStudentSearch(search: string): void {
    const term = (search ?? '').toLowerCase().trim();
    this.searchTerm.set(term);

    if (!term) {
      this.dataSource.set(this.students());
      return;
    }

    this.dataSource.set(
      this.students().filter(
        (student) =>
          student.fullName.toLowerCase().includes(term) ||
          student.registrationNumber.toLowerCase().includes(term)
      )
    );
  }

  getStudents() {
    this.loading.set(true);
    const { school, department, assignedLevel } =
      this.authService.activeAccount()!;

    const query = {
      school: school?._id,
      department: department?._id,
      level: assignedLevel ?? undefined,
    };

    forkJoin({
      list: this.studentService.getStudents(query),
      flags: this.studentService.getAcademicIssueFlags(query).pipe(
        catchError(() =>
          of<IAPIResponse<IStudentAcademicFlags>>({
            status: false,
            statusCode: '',
            data: { studentIdsWithFailedCourses: [] },
            message: '',
          })
        )
      ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ list, flags }) => {
          const sortedStudents = list.data.sort((a, b) =>
            (a.fullName ?? '').localeCompare(b.fullName ?? '')
          );

          this.students.set(sortedStudents);
          // Re-apply any active search term so a reload (upload/add) keeps
          // the current filter in sync with the search box.
          this.onStudentSearch(this.searchTerm());
          this.studentsWithIssues.set(
            new Set(flags.data.studentIdsWithFailedCourses ?? [])
          );
        },
      });
  }

  hasAcademicIssues(studentId: string | undefined): boolean {
    if (!studentId) return false;
    return this.studentsWithIssues().has(String(studentId));
  }

  uploadFile() {
    this.dialog
      .open(UploadDialogComponent, {
        width: '600px',
        data: {
          title: 'Upload Student List',
          description: 'Upload students list. Supported formats: .xlsx, .csv',
        },
      })
      .afterClosed()
      .subscribe({
        next: (file: File) => {
          if (file) this.uploadStudentsFile(file);
        },
      });
  }

  uploadStudentsFile(file: File) {
    this.uploading.set(true);

    this.lecturerService
      .importStudentDocument(file)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toastService.showNotification(
              'success',
              'Student List Uploaded',
              'Student list has been uploaded successfully'
            );

            this.getStudents();
          }
        },
      });
  }

  addStudent() {
    this.dialog
      .open(AddStudentDialogComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (result) => {
          if (result) this.getStudents();
        },
      });
  }

  viewStudentProfile(regNo: string) {
    this.router.navigate([regNo], { relativeTo: this.route });
  }

  /** Deactivate/reactivate a student (withdrawn/suspended) — never deletes. */
  toggleActivateDeactivate(student: IStudent) {
    const deactivating = (student as { isActive?: boolean }).isActive !== false;
    const ref = this.dialog.open(ConfirmationComponent, {
      data: {
        message: deactivating
          ? `Deactivate ${student.fullName}?`
          : `Reactivate ${student.fullName}?`,
        subTitle: deactivating
          ? 'They keep read access to results published before today, are ' +
            'skipped by auto-registration, and receive nothing published afterwards.'
          : 'They resume as a normal active student.',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.studentService
        .setStudentStatus(student._id, !deactivating)
        .subscribe({
          next: () => {
            this.toastService.showNotification(
              'success',
              deactivating ? 'Student deactivated' : 'Student reactivated',
              student.fullName ?? ''
            );
            this.getStudents();
          },
          error: (err: { error?: { message?: string } }) =>
            this.toastService.showNotification(
              'error',
              'Update failed',
              err?.error?.message ?? 'Could not update the student.'
            ),
        });
    });
  }
}
