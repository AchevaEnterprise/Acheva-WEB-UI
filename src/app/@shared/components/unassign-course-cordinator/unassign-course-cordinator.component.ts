import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { ToastService } from '../../../@core/utility/toast.service';
import { CoursesService } from '../../../@features/courses/services/courses.service';
import { AssignCourseCoordinatorComponent } from '../assign-course-coordinator/assign-course-coordinator.component';
import { ButtonComponent } from '../forms/button/button.component';
import { SvgComponent } from '../svg/svg.component';

@Component({
  selector: 'app-unassign-course-cordinator',
  imports: [MatDialogModule, ButtonComponent, SvgComponent],
  templateUrl: './unassign-course-cordinator.component.html',
  styleUrl: './unassign-course-cordinator.component.scss',
})
export class UnassignCourseCordinatorComponent {
  private readonly courseService = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(
    MatDialogRef<AssignCourseCoordinatorComponent>
  );
  readonly data = inject<{
    courseId: string;
    lecturerId: string;
  }>(MAT_DIALOG_DATA);

  cancel() {
    this.dialogRef.close();
  }

  unAssign() {
    const lecturerId = this.data.lecturerId;
    const courseId = this.data.courseId;
    this.courseService
      .unassignCourseFromLecturer(courseId, lecturerId)
      .subscribe({
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
