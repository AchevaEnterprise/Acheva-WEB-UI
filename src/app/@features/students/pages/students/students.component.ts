import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { UploadDialogComponent } from '../../../../@shared/components/upload-dialog/upload-dialog.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { LecturersService } from '../../../user-settings/service/lecturer.service';
import { IStudent } from '../../models/student.model';
import { StudentService } from '../../services/student.service';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-students',
  imports: [
    SearchInputComponent,
    ButtonComponent,
    MatTableModule,
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

  displayedColumns: string[] = ['registrationNumber', 'fullName'];
  dataSource = signal<IStudent[]>([]);

  loading = signal(false);
  uploading = signal(false);

  ngOnInit(): void {
    this.getStudents();
  }

  getStudents() {
    this.loading.set(true);
    const { school, department, assignedLevel } =
      this.authService.activeAccount()!;

    this.studentService
      .getStudents({
        school: school?._id,
        department: department?._id,
        level: assignedLevel,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          const sortedStudents = resp.data.sort((a, b) =>
            (a.fullName ?? '').localeCompare(b.fullName ?? '')
          );

          this.dataSource.set(sortedStudents);
        },
      });
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

  addStudent() {}
}
