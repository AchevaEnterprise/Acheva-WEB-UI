import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { ToastService } from '../../../@core/utility/toast.service';
import { AuthenticationService } from '../../../@features/auth/service/auth.service';
import { CoursesService } from '../../../@features/courses/services/courses.service';
import { ILecturer } from '../../../@features/user-settings/models/lecturer.model';
import { LecturersService } from '../../../@features/user-settings/service/lecturer.service';
import { ButtonComponent } from '../forms/button/button.component';
import { SearchSelectComponent } from '../forms/search-select/search-select.component';

@Component({
  selector: 'app-assign-course-coordinator',
  imports: [
    MatDialogModule,
    ButtonComponent,
    SearchSelectComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './assign-course-coordinator.component.html',
  styleUrl: './assign-course-coordinator.component.scss',
})
export class AssignCourseCoordinatorComponent implements OnInit {
  private readonly lecturerService = inject(LecturersService);
  private readonly authService = inject(AuthenticationService);
  private readonly courseService = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(
    MatDialogRef<AssignCourseCoordinatorComponent>
  );
  readonly data = inject<{
    courseId: string;
    courseTitle: string;
    courseCode: string;
  }>(MAT_DIALOG_DATA);

  form = new FormGroup({
    lecturer: new FormControl(null),
  });

  lecturers = signal<{ label: string; value: string }[]>([]);
  userDepartmentId = this.authService.activeAccount()?.department;

  searchLecturer(search: string) {
    // TODO: Implement search functionality for getting lecturers
    // return this.lecturerService.getdepartmentHOD(search);
  }

  ngOnInit(): void {
    this.getLecturers();
  }

  getLecturers() {
    this.lecturerService
      .getLecturersInDepartment(this.userDepartmentId!)
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            const lecturers = (resp.data.data as ILecturer[])?.map(
              (lecturer: ILecturer) => ({
                label: `${lecturer.firstname} ${lecturer.lastname}`,
                value: lecturer._id,
              })
            );
            this.lecturers.set(lecturers);
          }
        },
      });
  }

  cancel() {
    this.dialogRef.close();
  }

  assign() {
    const lecturerId = this.form.get('lecturer')?.value;
    const courseId = this.data.courseId;
    this.courseService.assignCourseToLecturer(courseId, lecturerId!).subscribe({
      next: (res) => {
        if (!res.status) {
          this.toast.showNotification(
            'error',
            'Error Assigning Course',
            'Failed to assign course to lecturer.'
          );
          return;
        }

        this.toast.showNotification(
          'success',
          'Course Assigned',
          'The course has been successfully assigned to the lecturer.'
        );
        this.dialogRef.close(res);
      },
    });
  }
}
