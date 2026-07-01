import { TitleCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  of,
} from 'rxjs';
import { IAPIResponse } from '../../../../@core/models/api-response.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { UploadDialogComponent } from '../../../../@shared/components/upload-dialog/upload-dialog.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { LecturersService } from '../../../user-settings/service/lecturer.service';
import { AddStudentDialogComponent } from '../../components/add-student-dialog/add-student-dialog.component';
import { IStudent, IStudentAcademicFlags } from '../../models/student.model';
import { StudentService } from '../../services/student.service';

@Component({
  selector: 'app-students',
  imports: [
    ReactiveFormsModule,
    SearchInputComponent,
    ButtonComponent,
    MatTableModule,
    MatTooltipModule,
    LoaderComponent,
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
    // 'actions',
  ];
  dataSource = signal<IStudent[]>([]);
  students = signal<IStudent[]>([]);
  /** Students with at least one failed course on a published result. */
  studentsWithIssues = signal<ReadonlySet<string>>(new Set());

  searchCtrl: FormControl = new FormControl<string>('');

  loading = signal(false);
  uploading = signal(false);

  ngOnInit(): void {
    this.getStudents();
    this.onStudentSearch();
  }

  onStudentSearch() {
    this.searchCtrl.valueChanges
      .pipe(debounceTime(800), distinctUntilChanged())
      .subscribe({
        next: (search: string) => {
          const term = (search ?? '').toLowerCase().trim();

          if (!term) {
            this.dataSource.set(this.students());
            return;
          }

          const searchedStudents = this.students().filter((student) =>
            student.fullName.toLowerCase().includes(term)
          );

          this.dataSource.set(searchedStudents);
        },
      });
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

          this.dataSource.set(sortedStudents);
          this.students.set(sortedStudents);
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

  toggleActivateDeactivate(student: IStudent) {}
}
